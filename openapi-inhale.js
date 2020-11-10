#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('yaml');
const recurse = require('reftools/lib/recurse.js').recurse;

const {strOptions} = require('yaml/types');

let argv = require('yargs')
    .usage('$0 <oasfile> <jsonfile> [outfile]',false,(yargs) => {
      yargs
      .positional('oasfile', { describe: 'the input openAPI spec' })
      .positional('jsonfile',{ describe: 'the input jsonSchema' })
      .positional('outfile', { describe: 'the output file' })
    })
    .strict()

    .boolean('p')
    .alias('p', 'properties')
    .default('p', false)
    .describe('p','don\'t grab properties from the jsonSchema')

    .boolean('d')
    .alias('d', 'definitions')
    .default('d', false)
    .describe('d','don\'t grab definitions from the jsonSchema')

    .string('i')
    .alias('i', 'importPrefix')
    .default('i', 'imp')
    .describe('i', 'import prefix to be added to the front of imported properties')

    .default('maxAliasCount',100)
    .describe('maxAliasCount','maximum YAML aliases allowed')
    .help()
    .version()
    .argv;

let s = fs.readFileSync(argv.oasfile,'utf8');
let oasSpec = yaml.parse(s, {maxAliasCount: argv.maxAliasCount});

let j = fs.readFileSync(argv.jsonfile, 'utf8');
let jsonSpec = yaml.parse(j, {maxAliasCount: argv.maxAliasCount});

//  $refs to #/definitions,  #/properties or argv.jsonfile#/properties need
//  to be converted into $refs to #/components/schemas..
let fixupRefs = (obj) => {
    recurse(obj, {}, function(obj, key, state) {

        // imported definitions/properties may have $refs to other definitions...
        if(obj.$ref && obj.$ref.startsWith('#/definitions/')) {
            obj.$ref = '#/components/schemas/' + obj.$ref.substring(14);
            
            // sibling annotations are not -strict
            if(obj.description)
                delete obj.description;
            if(obj.title)
                delete obj.title;
        }

        // imported definitions/properties may have $refs to other properties...
        if(obj.$ref && obj.$ref.startsWith('#/properties/')) {
            obj.$ref = '#/components/schemas/' + obj.$ref.substring(13);
            
            // sibling annotations are not -strict
            if(obj.description)
                delete obj.description;
            if(obj.title)
                delete obj.title;
        }

        // original oasSpec will have $refs to the argv.jsonfile#/properties
        if(obj.$ref && obj.$ref.startsWith(argv.jsonfile + '#/properties/')) {
            obj.$ref = '#/components/schemas/' + argv.importPrefix + obj.$ref.substring(argv.jsonfile.length+13);
        }

        // original oasSpec will have $refs to the argv.jsonfile#/definitions (which don't have importPrefix)
        if(obj.$ref && obj.$ref.startsWith(argv.jsonfile + '#/definitions/')) {
            obj.$ref = '#/components/schemas/' + obj.$ref.substring(argv.jsonfile.length+14);
        }
    });

    return obj;
};

// Turn $refs to argv.jsonfile into internal $refs...
Object.keys(oasSpec.components.schemas).forEach((key, ndx, keys) => {
    oasSpec.components.schemas[key] = fixupRefs(oasSpec.components.schemas[key]);
});

// maybe, grab the jsonSchema Properties
if(! argv.properties) {
    Object.keys(jsonSpec.properties).forEach((key, ndx, keys) => {
        oasSpec.components.schemas[argv.importPrefix+key] = fixupRefs(jsonSpec.properties[key]);
    });
}

// maybe, grab the jsonSchema Definitions
if(! argv.definitions) {
    Object.keys(jsonSpec.definitions).forEach((key, ndx, keys) => {
        oasSpec.components.schemas[key] = fixupRefs(jsonSpec.definitions[key]);
    });
}

let usedSchemas = [];

// check oasSpec.paths to get the set of components/schemas that're actually used...
Object.keys(oasSpec.paths).forEach((key, ndx, keys) => {

    recurse(oasSpec.paths[key], {}, (obj, key, state) => {

        // go looking for $refs
        if(obj.$ref && obj.$ref.startsWith('#/components/schemas/')) {

            if(! usedSchemas.includes(obj.$ref.substring(21))) {
                usedSchemas.push(obj.$ref.substring(21));
            }
        }
    });
});


// go looking for $refs in the set of usedSchemas...and augment the set of usedSchemas as appropriate
var additions;
do {    // keep going until we don't add any more schemas; cycles will break this.
    additions = 0;
    usedSchemas.forEach((key, ndx, keys) => {

        recurse(oasSpec.components.schemas[key], {}, (obj, key, state) => {

            // go looking for $refs
            if(obj.$ref && obj.$ref.startsWith('#/components/schemas/')) {

                if(! usedSchemas.includes(obj.$ref.substring(21))) {
                    usedSchemas.push(obj.$ref.substring(21));
                    additions++;
                }
            }
        });
    });
} while (additions > 0);

// prune the set of schemas in the original oasSpec, to be only the ones we're using...
Object.keys(oasSpec.components.schemas).forEach((key, ndx, keys) => {

    if(! usedSchemas.includes(key)) {
        delete oasSpec.components.schemas[key];
    }
});

// the result string... in YAML or JSON as requested
s = (argv.outfile && argv.outfile.endsWith('.json')) ?  JSON.stringify(oasSpec, null, 2) : yaml.stringify(oasSpec);

// write it to the correct place...
if (argv.outfile) {
    fs.writeFileSync(argv.outfile,s,'utf8');
}
else {
    console.log(s);
}

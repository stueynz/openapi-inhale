# openapi-inhale


Inhale external `$refs` to a JSON schema into internal `$refs` by importing the matching
jsonSchema `properties` and `definitions` into the OpenAPI specification.

Only import those `properties` and `definitions` that are actually used by the OpenAPI specification.

Works with OpenAPI 3.0.x definitions and $draft7 JSON Schemas

```
openapi-inhale.js <oasfile> <jsonfile> [outfile]

Positionals:
  oasfile   the input openAPI spec
  jsonfile  the input jsonSchema
  outfile   the output file

Options:
  -p, --properties    don't grab properties from the jsonSchema
                                                      [boolean] [default: false]
  -d, --definitions   don't grab definitions from the jsonSchema
                                                      [boolean] [default: false]
  -i, --importPrefix  import prefix to be added to the front of imported
                      properties                       [string] [default: "imp"]
  --maxAliasCount     maximum YAML aliases allowed                [default: 100]
  --help              Show help                                        [boolean]
  --version           Show version number                              [boolean]

```

use `--` to separate flags or other array options from following options, i.e.:

```bash
  openapi-inhale -i create -- openApi.yaml jsonSchema.yaml output.yaml
```

will resolve the `$refs` in `openApi.yaml` that point to `jsonSchema.yaml`,  using prefix `create` to distinguish the imported `properties`.  `definitions` are imported without a prefix.


```bash
  openapi-inhale -i create -- openApi.yaml jsonSchema.yaml output.json
```
will do the same, except the result outfile will be in JSON format.


```bash
  openapi-inhale -d -i patch -- openApi.yaml jsonSchema.yaml output.yaml
```

will resolve the `$refs` in `openApi.yaml` that point to `jsonSchema.yaml`,  with prefix `patch` without importing the definitions (because they've already been imported previously).  NOTE: properties in `jsonSchema.yaml` are imported.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseDocument } from "yaml";
import { format, resolveConfig } from "prettier";
import { cliJsonSchemas } from "../apps/api/src/cli-response-schemas";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "openapi/frontier-v1.yaml");
const doc = parseDocument(await readFile(path, "utf8"));
if (doc.errors.length) throw doc.errors[0];
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (name: string, description: string) => ({
  description,
  content: { "application/json": { schema: ref(name) } },
});
const schemaMap = cliJsonSchemas;
for (const [name, schema] of Object.entries(schemaMap)) {
  const { $schema: _dialect, ...body } = schema;
  void _dialect;
  doc.setIn(["components", "schemas", name], body);
}
doc.setIn(["components", "securitySchemes", "PrivyIdentityToken"], {
  type: "apiKey",
  in: "header",
  name: "x-privy-identity-token",
});
doc.setIn(["components", "securitySchemes", "CliSession"], {
  type: "http",
  scheme: "bearer",
  bearerFormat: "opaque frontier_cli_ session",
});
const security = [{ PrivyAccessToken: [], PrivyIdentityToken: [] }, { CliSession: [] }];
const contextParameters = [
  {
    in: "header",
    name: "X-Frontier-Context-Hash",
    required: false,
    schema: ref("Bytes32"),
    description: "Expected context; CLI always sends this precondition.",
  },
  {
    in: "header",
    name: "X-Frontier-Runtime-Context-Hash",
    required: false,
    schema: ref("Bytes32"),
    description: "Required with a context precondition for Doctrine evaluations.",
  },
];
doc.setIn(["paths", "/v1/cli/arenas"], {
  get: {
    operationId: "listCliArenas",
    responses: {
      "200": response("CliArenaList", "Versioned capabilities for supported CLI arenas"),
    },
  },
});
doc.setIn(["paths", "/v1/cli/arenas/{id}"], {
  get: {
    operationId: "getCliArena",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string", enum: ["disaster-response", "rescue-room"] },
      },
    ],
    responses: {
      "200": response(
        "CliArenaManifest",
        "Public input contract, fixed context, archive digest and live capabilities",
      ),
      "404": response("CliApiError", "Unsupported arena"),
    },
  },
});
const endpointResults = [
  ["/v1/disaster-response/evaluations", "post", "200", "CliDisasterPracticeResult"],
  ["/v1/rescue-room/doctrine-evaluations", "post", "200", "CliRescuePracticeResult"],
  ["/v1/challenges/disaster-response/join", "post", "201", "CliJoinResult"],
  ["/v1/challenges/disaster-response/submissions", "post", "201", "CliSubmissionResult"],
  ["/v1/challenges/disaster-response/submissions/mine", "get", "200", "CliMySubmissions"],
  ["/v1/challenges/disaster-response/final-entry", "put", "200", "CliFinalEntryResult"],
] as const;
for (const [endpoint, method, status, result] of endpointResults) {
  doc.setIn(
    ["paths", endpoint, method, "responses", status],
    response(result, "Validated response; independent metrics and evidence states are preserved"),
  );
  for (const failure of ["400", "401", "403", "409", "429", "503"]) {
    doc.setIn(
      ["paths", endpoint, method, "responses", failure],
      response("CliApiError", "Structured API error"),
    );
  }
  if (endpoint.startsWith("/v1/challenges/"))
    doc.setIn(["paths", endpoint, method, "security"], security);
}
doc.setIn(
  ["paths", "/v1/challenges/disaster-response/submissions", "post", "responses", "200"],
  response(
    "CliSubmissionResult",
    "Existing submission returned for the identical idempotent operation",
  ),
);
for (const endpoint of [
  "/v1/disaster-response/evaluations",
  "/v1/rescue-room/doctrine-evaluations",
])
  doc.setIn(["paths", endpoint, "post", "parameters"], contextParameters);
doc.setIn(
  ["paths", "/v1/challenges/disaster-response/submissions", "post", "parameters"],
  [
    ...contextParameters,
    {
      in: "header",
      name: "Idempotency-Key",
      required: true,
      schema: { type: "string", minLength: 8, maxLength: 128 },
      description: "Bind one immutable body to one operation; reuse on retry.",
    },
  ],
);
doc.setIn(
  ["paths", "/v1/challenges/disaster-response/final-entry", "put", "parameters"],
  contextParameters,
);
const authPaths = [
  ["device", "post", "CliAuthDeviceInput", "CliAuthDeviceResult", "none"],
  ["inspect", "post", "CliAuthCodeInput", "CliAuthInspection", "browser"],
  ["approve", "post", "CliAuthApprovalInput", "CliAuthApprovalResult", "browser"],
  ["token", "post", "CliAuthTokenInput", "CliAuthTokenResult", "none"],
  ["session", "get", null, "CliAuthSession", "cli"],
  ["revoke", "post", null, "CliAuthRevoked", "cli"],
] as const;
for (const [action, method, input, result, auth] of authPaths) {
  const operation: Record<string, unknown> = {
    operationId: `cliAuth${action[0]!.toUpperCase()}${action.slice(1)}`,
    description:
      "Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI.",
    responses: {
      "200": response(result, "No-store authorization response"),
      ...Object.fromEntries(
        ["400", "401", "403", "409", "415", "429", "503"].map((status) => [
          status,
          response(
            "CliApiError",
            "Authorization error; authorization_pending and slow_down are polling states, not new login requests",
          ),
        ]),
      ),
    },
  };
  if (input)
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(input) } },
    };
  if (auth === "cli") operation.security = [{ CliSession: [] }];
  if (auth === "browser") {
    operation.security = [{ PrivyAccessToken: [], PrivyIdentityToken: [] }];
    operation.parameters = [
      {
        in: "header",
        name: "Origin",
        required: true,
        schema: { type: "string", format: "uri" },
        description: "Must equal configured FRONTIER_CLI_ORIGIN",
      },
      {
        in: "header",
        name: "X-Frontier-Cli-Csrf",
        required: true,
        schema: { type: "string", const: "1" },
      },
    ];
  }
  doc.setIn(["paths", `/v1/cli/auth/${action}`, method], operation);
}
await writeFile(
  path,
  await format(doc.toString({ lineWidth: 100 }), {
    ...(await resolveConfig(path)),
    parser: "yaml",
  }),
  "utf8",
);
const output = resolve(root, "openapi/generated");
await mkdir(output, { recursive: true });
await writeFile(
  resolve(output, "cli.schemas.json"),
  await format(
    JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $defs: schemaMap }),
    { ...(await resolveConfig(path)), parser: "json" },
  ),
);
await writeFile(
  resolve(output, "cli.contract.json"),
  JSON.stringify(
    {
      schemaVersion: "1",
      generator: "export-cli-contract-v1",
      openapiSha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write("Updated CLI OpenAPI contracts and generated schema snapshot.\n");

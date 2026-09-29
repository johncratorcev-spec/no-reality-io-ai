import pg from "pg";

const PASS = "bz%2Fs4FpQz9%2Awv%2FD";
const REF = "arwdhvfffzdljctryjfw";

const regions = [
  "aws-0-eu-central-1", "aws-0-eu-west-1", "aws-0-eu-west-2", "aws-0-eu-west-3",
  "aws-0-us-east-1", "aws-0-us-east-2", "aws-0-us-west-1", "aws-0-us-west-2",
  "aws-0-ap-southeast-1", "aws-0-ap-southeast-2", "aws-0-ap-northeast-1", "aws-0-ap-northeast-2",
  "aws-0-ap-south-1", "aws-0-ap-east-1", "aws-0-ca-central-1", "aws-0-eu-north-1",
  "aws-0-eu-south-1", "aws-0-sa-east-1", "aws-0-me-central-1", "aws-0-me-south-1", "aws-0-af-south-1",
  "aws-1-eu-central-1", "aws-1-eu-west-1", "aws-1-eu-west-2", "aws-1-eu-west-3", "aws-1-eu-north-1",
  "aws-1-eu-south-1", "aws-1-us-east-1", "aws-1-us-east-2", "aws-1-us-west-1", "aws-1-us-west-2",
  "aws-1-ca-central-1", "aws-1-sa-east-1", "aws-1-ap-northeast-1", "aws-1-ap-northeast-2",
  "aws-1-ap-south-1", "aws-1-ap-southeast-1", "aws-1-ap-southeast-2", "aws-1-ap-east-1",
  "aws-1-me-central-1", "aws-1-af-south-1",
  "aws-2-eu-central-1", "aws-2-us-east-1", "aws-2-us-east-2", "aws-2-ap-southeast-1", "aws-2-ap-northeast-1",
];

for (const r of regions) {
  const client = new pg.Client({
    connectionString: `postgresql://postgres.${REF}:${PASS}@${r}.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 9000,
  });
  try {
    await client.connect();
    const q = await client.query("select count(*)::int as n from \"Account\"");
    console.log(`OK  ${r} → accounts=${q.rows[0].n}`);
    await client.end();
    process.exit(0);
  } catch (e) {
    const msg = String(e.message).slice(0, 80).replace(/\n/g, " ");
    console.log(`ERR ${r} → ${msg}`);
    try { await client.end(); } catch {}
  }
}
console.log("NO REGION WORKED");
process.exit(1);

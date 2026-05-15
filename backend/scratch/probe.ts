import { Client } from 'pg';

const password = "Hashtech@123";
const ref = "virfeveeuervxkuayzdq";
const region = "ap-northeast-2";
const host = `aws-0-${region}.pooler.supabase.com`;

async function probe(user: string, port: number) {
    console.log(`\nProbing User: ${user} on Port: ${port}...`);
    const client = new Client({
        user: user,
        password: password,
        host: host,
        port: port,
        database: 'postgres',
        connectionTimeoutMillis: 5000,
    });
    try {
        await client.connect();
        console.log(`SUCCESS connecting with ${user} on ${port}!`);
        await client.end();
        return true;
    } catch (err: any) {
        console.log(`FAILED: ${err.message}`);
        return false;
    }
}

async function run() {
    await probe(`postgres.${ref}`, 5432);
    await probe(`postgres.${ref}`, 6543);
    await probe(`postgres`, 5432);
    await probe(`postgres`, 6543);
}

run();

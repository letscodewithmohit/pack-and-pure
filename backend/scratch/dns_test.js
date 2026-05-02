import dns from 'node:dns';

const hostname = 'ac-nvd1gp8-shard-00-01.zt5qtp7.mongodb.net';

console.log(`Checking resolution for ${hostname}...`);

dns.lookup(hostname, (err, address, family) => {
  if (err) {
    console.error('DNS Lookup failed:', err);
  } else {
    console.log(`Address: ${address}, Family: IPv${family}`);
  }
});

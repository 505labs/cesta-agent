function countPrimes(limit: number): number {
  const sieve = new Uint8Array(limit);
  let count = 0;

  for (let i = 2; i < limit; i++) {
    if (sieve[i] === 0) {
      count++;
      for (let j = i * i; j < limit; j += i) {
        sieve[j] = 1;
      }
    }
  }

  return count;
}

const limit = 1_000_000;
const start = performance.now();
const result = countPrimes(limit);
const elapsed = (performance.now() - start).toFixed(2);

console.log(`Number of primes below ${limit.toLocaleString()}: ${result.toLocaleString()}`);
console.log(`Time: ${elapsed}ms`);

export function createSiweMessage({
  address,
  chainId,
  nonce,
  domain,
  uri,
}: {
  address: string;
  chainId: number;
  nonce: string;
  domain: string;
  uri: string;
}): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to RoadTrip Co-Pilot",
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

import { BadRequestError } from '../../utils/customErrors.js';

const PINATA_JSON_ENDPOINT = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

/**
 * Upload event metadata JSON to IPFS via Pinata.
 * Returns null when PINATA_JWT is not configured.
 */
export async function uploadEventMetadataToIpfs(metadata) {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) return null;

  const payload = {
    pinataMetadata: {
      name: `event-metadata-${Date.now()}`,
    },
    pinataContent: metadata,
  };

  const response = await fetch(PINATA_JSON_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok || !json?.IpfsHash) {
    throw new BadRequestError(
      json?.error?.reason || json?.message || 'Failed to upload metadata to IPFS',
    );
  }

  return `ipfs://${json.IpfsHash}`;
}

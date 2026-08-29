/**
 * Foodify — Sanity client bridge (plain JS / ES module, no framework).
 *
 * Uses the official @sanity/client + @sanity/image-url packages, loaded as
 * ES modules from the esm.sh CDN so that no build step is required.
 *
 * This project id / dataset must match studio-foodify/sanity.config.ts
 */
const PROJECT_ID = 'n1b65k4e'
const DATASET = 'production'
const API_VERSION = '2024-10-01'

let clientPromise = null

async function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.all([
      import('https://esm.sh/@sanity/client@6?bundle'),
      import('https://esm.sh/@sanity/image-url@1?bundle'),
    ]).then(([clientMod, urlMod]) => {
      const client = clientMod.createClient({
        projectId: PROJECT_ID,
        dataset: DATASET,
        apiVersion: API_VERSION,
        useCdn: true, // Fast, cached reads for a marketing site
        perspective: 'published', // Only published content
      })
      const builder = urlMod.default({clientId: PROJECT_ID, dataset: DATASET})
      return {client, builder}
    })
  }
  return clientPromise
}

/**
 * Run a GROQ query. Resolves to null on any network/config error so the
 * page can keep its hardcoded fallback content.
 */
export async function sanityFetch(query, params = {}) {
  try {
    const {client} = await getClient()
    return await client.fetch(query, params)
  } catch (err) {
    console.warn('[Foodify CMS] Fetch failed, using fallback content.', err)
    return null
  }
}

/**
 * Build a CDN URL for a Sanity image reference.
 * e.g. urlFor(image).width(1200).height(675).fit('crop').auto('format').url()
 * Returns null when the reference is missing.
 */
export async function imageUrl(imageRef, opts = {}) {
  // Already a plain URL string (e.g. from GROQ "image": image.asset->url).
  if (typeof imageRef === 'string' && imageRef) return imageRef
  // Full object with a resolved CDN url (e.g. image{asset->{url}}).
  if (imageRef && imageRef.asset && imageRef.asset.url) return imageRef.asset.url
  if (!imageRef || !imageRef.asset) return null
  try {
    const {builder} = await getClient()
    let u = builder.image(imageRef)
    if (opts.width) u = u.width(opts.width)
    if (opts.height) u = u.height(opts.height)
    if (opts.fit) u = u.fit(opts.fit)
    return u.auto('format').url()
  } catch (err) {
    console.warn('[Foodify CMS] Image URL build failed.', err)
    return null
  }
}

export const config = {PROJECT_ID, DATASET, API_VERSION}

import { createClient } from 'next-sanity';
import { createImageUrlBuilder } from '@sanity/image-url';
type SanityImageSource = any;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '';
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET   || 'production';
const token     = process.env.SANITY_API_TOKEN || '';
const isSanityConfigured = Boolean(projectId && /^[a-z0-9-]+$/.test(projectId));

export const config = {
  projectId: isSanityConfigured ? projectId : 'placeholder',
  dataset,
  apiVersion: '2024-01-01',
  // Com token e apiVersion antiga, o padrão é 'raw' (inclui rascunhos). Forçamos só publicados.
  perspective: 'published' as const,
  useCdn: token ? false : process.env.NODE_ENV === 'production',
  token: token || undefined,
};

if (!isSanityConfigured) {
  console.warn('[sanity] NEXT_PUBLIC_SANITY_PROJECT_ID ausente ou inválido — o blog ficará vazio.');
}

export const sanityClient = isSanityConfigured ? createClient(config) : null;

/** Cliente que enxerga rascunhos (apenas usado em modo preview, nunca para visitantes). */
function previewClient() {
  return sanityClient!.withConfig({ perspective: 'drafts', useCdn: false, token: token || undefined });
}

const builder = isSanityConfigured ? createImageUrlBuilder(config) : null;

export function urlFor(source: SanityImageSource) {
  const empty = {
    url: () => '',
    width: () => empty,
    height: () => empty,
    fit: () => empty,
    auto: () => empty,
    quality: () => empty,
    format: () => empty,
  } as any;
  if (!builder || !source || (typeof source === 'object' && !source.asset && !source._ref && !source._id)) return empty;
  return builder.image(source);
}

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface Post {
  _id: string;
  title: string;
  slug: { current: string };
  publishedAt: string;
  category: string;
  excerpt: string;
  mainImage: SanityImageSource & { alt?: string };
  author?: { name: string; photo?: SanityImageSource };
  body?: unknown[];
  // English versions (optional)
  titleEn?: string;
  excerptEn?: string;
  bodyEn?: unknown[];
}

// ─────────────────────────────────────────
// GROQ Queries
// ─────────────────────────────────────────

/** Todos os posts ordenados por data (apenas publicados com data <= atual) */
export async function getAllPosts(preview = false): Promise<Post[]> {
  if (!sanityClient) return [];
  // Em preview (Studio → Presentation) inclui rascunhos e posts agendados.
  const client = preview ? previewClient() : sanityClient;
  const filter = preview ? '' : ' && (!defined(publishedAt) || publishedAt <= now())';
  return client.fetch(
    `*[_type == "post"${filter}] | order(publishedAt desc) {
      _id,
      title, titleEn,
      slug,
      publishedAt,
      "category": category->title,
      excerpt, excerptEn,
      mainImage,
      author
    }`
  );
}

const POST_FIELDS = `
  _id,
  title, titleEn,
  slug,
  publishedAt,
  "category": category->title,
  excerpt, excerptEn,
  mainImage,
  author,
  body, bodyEn
`;

const POST_QUERY = `*[_type == "post" && slug.current == $slug && (!defined(publishedAt) || publishedAt <= now())][0] {${POST_FIELDS}}`;
const POST_PREVIEW_QUERY = `*[_type == "post" && slug.current == $slug][0] {${POST_FIELDS}}`;

/** Post individual por slug. Em modo rascunho (preview) inclui posts não publicados. */
export async function getPostBySlug(slug: string, preview = false): Promise<Post | null> {
  if (!sanityClient) return null;
  if (preview) {
    const result = await previewClient()
      .fetch(POST_PREVIEW_QUERY, { slug }, { cache: 'no-store' });
    return result ?? null;
  }
  const result = await sanityClient.fetch(POST_QUERY, { slug });
  return result ?? null;
}

/** Todas as categorias distintas */
export async function getCategories(preview = false): Promise<string[]> {
  if (!sanityClient) return [];
  return (preview ? previewClient() : sanityClient).fetch(
    `array::unique(*[_type == "post" && defined(category)].category->title) | order(@ asc)`
  );
}

/** Posts relacionados na mesma categoria */
export async function getRelatedPosts(category: string, excludeId: string, preview = false): Promise<Post[]> {
  if (!sanityClient) return [];
  return (preview ? previewClient() : sanityClient).fetch(
    `*[_type == "post" && category->title == $category && _id != $excludeId] | order(publishedAt desc)[0...3] {
      _id,
      title,
      slug,
      publishedAt,
      "category": category->title,
      excerpt,
      mainImage
    }`,
    { category, excludeId }
  );
}

/** Estima tempo de leitura em minutos a partir do Portable Text */
export function estimateReadTime(body: unknown[]): number {
  if (!body) return 1;
  const text = body
    .filter((b: any) => b._type === 'block')
    .map((b: any) => b.children?.map((c: any) => c.text).join('') ?? '')
    .join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

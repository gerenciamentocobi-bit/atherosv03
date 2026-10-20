import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PortableText } from '@portabletext/react';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import DraftPreview from '@/components/DraftPreview/DraftPreview';
import { getPostBySlug, getRelatedPosts, estimateReadTime, urlFor } from '@/lib/sanity';
import styles from './post.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.mainImage ? [urlFor(post.mainImage).width(1200).height(630).url()] : [],
    },
  };
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr));
  } catch { return dateStr; }
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const post = await getPostBySlug(slug, isDraft);
  if (!post) notFound();

  const related = post.category
    ? await getRelatedPosts(post.category, post._id, isDraft)
    : [];

  const readTime = post.body ? estimateReadTime(post.body as any[]) : 1;

  return (
    <main className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={`container ${styles.heroInner}`}>
          {post.category && <span className={styles.heroBadge}>{post.category}</span>}
          <h1 className={styles.heroTitle}>{post.title}</h1>
          <div className={styles.heroMeta}>
            {post.author?.name && (
              <span className={styles.author}>
                {(post.author.photo as any)?.asset && (
                  <Image
                    src={urlFor(post.author.photo).width(36).height(36).url()}
                    alt={post.author.name}
                    width={36} height={36}
                    className={styles.authorPhoto}
                  />
                )}
                {post.author.name}
              </span>
            )}
            <span className={styles.metaDot}>·</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span className={styles.metaDot}>·</span>
            <span>{readTime} min de leitura</span>
          </div>
        </div>
      </section>

      {/* ── Main Image ── */}
      {(post.mainImage as any)?.asset && (
        <div className={`container ${styles.mainImageWrap}`}>
          <div className={styles.mainImage}>
            <Image
              src={urlFor(post.mainImage).width(1200).height(630).url()}
              alt={(post.mainImage as any)?.alt || post.title}
              fill
              className={styles.mainImg}
              priority
            />
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className={`container ${styles.layout}`}>
        {/* Article */}
        <article className={styles.article}>
          {post.excerpt && <p className={styles.lead}>{post.excerpt}</p>}
          {post.body && (
            <div className={styles.body}>
              <PortableText
                value={post.body as any}
                components={{
                  types: {
                    image: ({ value }) => !value?.asset ? null : (
                      <figure className={styles.inlineImg}>
                        <Image
                          src={urlFor(value).width(800).url()}
                          alt={value.alt || ''}
                          width={800}
                          height={450}
                          className={styles.inlineImgEl}
                        />
                        {value.caption && <figcaption>{value.caption}</figcaption>}
                      </figure>
                    ),
                  },
                  block: {
                    blockquote: ({ children }) => (
                      <blockquote className={styles.blockquote}>{children}</blockquote>
                    ),
                  },
                }}
              />
            </div>
          )}

          {/* Share / Back */}
          <div className={styles.postFooter}>
            <Link href="/blog" className={styles.backLink}>
              ← Voltar ao Blog
            </Link>
            <a
              href={`https://api.whatsapp.com/send/?phone=19046515886&text=${encodeURIComponent('Olá! Vim pelo blog da Atheros e tenho uma dúvida.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whaBtn}
            >
              Tirar dúvida no WhatsApp
            </a>
          </div>
        </article>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarTitle}>Precisa de ajuda?</h3>
            <p className={styles.sidebarText}>
              Tire suas dúvidas com nossa equipe agora mesmo. Atendimento em português, sem custo.
            </p>
            <a
              href={`https://api.whatsapp.com/send/?phone=19046515886&text=${encodeURIComponent('Olá! Li um artigo no blog da Atheros e gostaria de tirar uma dúvida.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sidebarBtn}
            >
              Falar no WhatsApp
            </a>
          </div>
        </aside>
      </div>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className={styles.related}>
          <div className="container">
            <h2 className={styles.relatedTitle}>Artigos relacionados</h2>
            <div className={styles.relatedGrid}>
              {related.map((r) => (
                <Link key={r._id} href={`/blog/${r.slug.current}`} className={styles.relatedCard}>
                  {(r.mainImage as any)?.asset && (
                    <div className={styles.relatedImg}>
                      <Image
                        src={urlFor(r.mainImage).width(400).height(240).url()}
                        alt={r.title}
                        fill
                        className={styles.relatedImgEl}
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                  )}
                  <div className={styles.relatedBody}>
                    <h3 className={styles.relatedCardTitle}>{r.title}</h3>
                    <span className={styles.relatedRead}>Ler artigo →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <DraftPreview />
    </main>
  );
}

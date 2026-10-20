import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { getAllPosts, getCategories } from '@/lib/sanity';
import BlogClientPage from './BlogClientPage';
import DraftPreview from '@/components/DraftPreview/DraftPreview';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Artigos sobre documentação consular, passaportes, procurações e tudo que o brasileiro nos EUA precisa saber.',
};

export const revalidate = 60;

export default async function BlogPage() {
  // Modo rascunho só é ativado pelo Studio (Presentation); visitantes veem apenas publicados.
  const { isEnabled: isDraft } = await draftMode();
  const [posts, categories] = await Promise.all([
    getAllPosts(isDraft),
    getCategories(isDraft),
  ]);

  return (
    <>
      <BlogClientPage initialPosts={posts} initialCategories={categories} />
      <DraftPreview />
    </>
  );
}

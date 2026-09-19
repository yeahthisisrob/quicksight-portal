import { SmusGate } from '@/entities/smus';
import { AuthorStudio } from '@/features/author';

/** /author?type=dashboard|analysis&id=<assetId> - only with an active SMUS project. */
export default function AuthorPage() {
  return (
    <SmusGate subject="Author">
      <AuthorStudio />
    </SmusGate>
  );
}

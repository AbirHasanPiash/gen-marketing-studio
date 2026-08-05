import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { get, post } from '../../lib/api';

export default function PublicLinkBioPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-page', slug],
    queryFn: () => get(`/public/pages/${slug}`),
    retry: false,
  });

  const onClick = async (link) => {
    try {
      const res = await post(`/public/links/${link.id}/click`);
      window.open(res.url || link.url, '_blank', 'noopener');
    } catch {
      window.open(link.url, '_blank', 'noopener');
    }
  };

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-white/70" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center">
        <div>
          <p className="text-5xl">🔍</p>
          <h1 className="mt-4 text-xl font-bold text-white">Page not found</h1>
          <p className="mt-1 text-white/60">This link-in-bio page doesn’t exist or isn’t published.</p>
        </div>
      </div>
    );
  }

  const bg = data.theme?.bg || '#1D3557';
  const accent = data.theme?.accent || '#E9C46A';

  return (
    <div className="min-h-screen w-full px-4 py-12" style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${accent}22, transparent), ${bg}` }}>
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt={data.title} className="h-24 w-24 rounded-full object-cover ring-4 ring-white/20 shadow-xl" />
        ) : (
          <div className="h-24 w-24 rounded-full bg-white/15" />
        )}
        <h1 className="mt-5 font-display text-2xl font-bold text-white">{data.title}</h1>
        {data.bio && <p className="mt-2 max-w-sm text-white/70">{data.bio}</p>}

        <div className="mt-8 w-full space-y-3.5">
          {data.links?.length ? (
            data.links.map((l) => (
              <button
                key={l.id}
                onClick={() => onClick(l)}
                className="group flex w-full items-center justify-between rounded-2xl px-5 py-4 font-semibold shadow-lg transition hover:scale-[1.02] active:scale-[0.99]"
                style={{ background: accent, color: '#111' }}
              >
                <span>{l.label}</span>
                <ArrowUpRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            ))
          ) : (
            <p className="text-white/50">No links yet.</p>
          )}
        </div>

        <Link to="/" className="mt-12 inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition">
          <Sparkles className="h-3.5 w-3.5" /> Made with mkt_studio
        </Link>
      </div>
    </div>
  );
}

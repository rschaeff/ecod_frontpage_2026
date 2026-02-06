import Link from 'next/link';
import HeroSearch from '@/components/search/HeroSearch';
import StatsDisplay from '@/components/ui/StatsDisplay';
import NewsPreview from '@/components/ui/NewsPreview';

const CITATIONS = [
  {
    authors: 'Schaeffer RD, Medvedev KE, Andreeva A, Chuguransky SR, Pinto BL, Zhang J, Cong Q, Bateman A, Grishin NV',
    title: 'ECOD: integrating classifications of protein domains from experimental and predicted structures',
    journal: 'Nucleic Acids Research',
    year: 2025,
    doi: '10.1093/nar/gkae1029',
    prominent: true,
  },
  {
    authors: 'Schaeffer RD, Liao Y, Cheng H, Grishin NV',
    title: 'ECOD: new developments in the evolutionary classification of domains',
    journal: 'Nucleic Acids Research',
    year: 2017,
    doi: '10.1093/nar/gkw1137',
    prominent: false,
  },
  {
    authors: 'Cheng H, Schaeffer RD, Liao Y, Kinch LN, Pei J, Shi S, Kim BH, Grishin NV',
    title: 'ECOD: An evolutionary classification of protein domains',
    journal: 'PLoS Comput Biol 10(12): e1003926',
    year: 2014,
    doi: '10.1371/journal.pcbi.1003926',
    prominent: false,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/50 dark:to-gray-900 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Evolutionary Classification of Protein Domains
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            A hierarchical classification combining automated sequence and structure
            analysis with manual curation to organize protein domain structures.
          </p>

          {/* Search */}
          <div className="flex justify-center mb-8">
            <HeroSearch />
          </div>

          {/* Quick Stats */}
          <StatsDisplay />
        </div>
      </section>

      {/* News Section */}
      <section className="py-16 px-4 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <NewsPreview />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">
            Explore ECOD
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Browse */}
            <FeatureCard
              href="/tree"
              title="Browse Classification"
              description="Navigate the hierarchical classification tree from architectures to families and individual domains."
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              }
            />

            {/* Search */}
            <FeatureCard
              href="/search"
              title="Search Domains"
              description="Find domains by UID, domain ID, UniProt accession, PDB ID, or keyword search."
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />

            {/* Download */}
            <FeatureCard
              href="/distribution"
              title="Download Data"
              description="Access bulk downloads of domain classifications, sequences, and structure data."
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Citations Section */}
      <section className="py-16 px-4 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-8">
            Cite ECOD
          </h2>

          {/* Prominent citation */}
          {CITATIONS.filter(c => c.prominent).map(c => (
            <div
              key={c.doi}
              className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 mb-6"
            >
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 mb-3">
                Most Recent
              </span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                {c.authors} ({c.year})
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 italic mb-1">
                {c.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {c.journal}
              </p>
              <a
                href={`https://doi.org/${c.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                doi:{c.doi} →
              </a>
            </div>
          ))}

          {/* Other citations */}
          <div className="grid md:grid-cols-2 gap-4">
            {CITATIONS.filter(c => !c.prominent).map(c => (
              <div
                key={c.doi}
                className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700"
              >
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {c.authors} ({c.year})
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 italic mb-1">
                  {c.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                  {c.journal}
                </p>
                <a
                  href={`https://doi.org/${c.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  doi:{c.doi} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Component for feature cards
function FeatureCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
    >
      <div className="text-blue-600 dark:text-blue-400 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </Link>
  );
}

import Link from 'next/link';
import SearchBar from '@/components/search/SearchBar';
import StatsDisplay from '@/components/ui/StatsDisplay';

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/50 dark:to-gray-900 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Evolutionary Classification of
            <span className="text-blue-600 dark:text-blue-400"> Protein Domains</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            A hierarchical classification combining automated sequence and structure
            analysis with manual curation to organize protein domain structures.
          </p>

          {/* Search */}
          <div className="flex justify-center mb-8">
            <SearchBar />
          </div>

          {/* Quick Stats */}
          <StatsDisplay />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 dark:bg-gray-900">
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

      {/* Classification Levels */}
      <section className="bg-gray-50 dark:bg-gray-800 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-8">
            Classification Hierarchy
          </h2>

          <div className="space-y-4">
            <LevelRow
              level="A"
              name="Architecture"
              description="Highest level grouping based on overall protein fold architecture"
              color="bg-purple-100 text-purple-800"
            />
            <LevelRow
              level="X"
              name="X-group"
              description="Possible homology - domains that may share evolutionary origin"
              color="bg-blue-100 text-blue-800"
            />
            <LevelRow
              level="H"
              name="H-group"
              description="Homology - domains with confirmed evolutionary relationship"
              color="bg-green-100 text-green-800"
            />
            <LevelRow
              level="T"
              name="T-group"
              description="Topology - domains with similar structural topology"
              color="bg-yellow-100 text-yellow-800"
            />
            <LevelRow
              level="F"
              name="F-group"
              description="Family - closely related domains with high sequence similarity"
              color="bg-orange-100 text-orange-800"
            />
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="py-16 px-4 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Data Sources</h2>
          <div className="flex flex-wrap justify-center gap-8">
            <a
              href="https://www.rcsb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              RCSB PDB
            </a>
            <a
              href="https://alphafold.ebi.ac.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              AlphaFold DB
            </a>
            <a
              href="https://www.uniprot.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              UniProt
            </a>
            <a
              href="https://pfam.xfam.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              Pfam
            </a>
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

// Component for classification level rows
function LevelRow({
  level,
  name,
  description,
  color,
}: {
  level: string;
  name: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${color}`}>
        {level}
      </span>
      <div>
        <div className="font-semibold text-gray-900 dark:text-gray-100">{name}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
      </div>
    </div>
  );
}

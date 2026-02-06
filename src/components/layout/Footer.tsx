import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              About ECOD
            </h3>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              ECOD (Evolutionary Classification of Protein Domains) is a hierarchical
              classification of protein domains based on evolutionary relationships.
              It combines automated sequence and structure analysis with manual curation.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/tree" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                  Browse Classification
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/distribution" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                  Download Data
                </Link>
              </li>
              <li>
                <Link href="/documentation" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Resources
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="http://prodata.swmed.edu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Grishin Lab
                </a>
              </li>
              <li>
                <a
                  href="https://www.utsouthwestern.edu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  UT Southwestern
                </a>
              </li>
              <li>
                <a
                  href="https://www.rcsb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  RCSB PDB
                </a>
              </li>
              <li>
                <a
                  href="https://alphafold.ebi.ac.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  AlphaFold DB
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            &copy; 2014-{currentYear}{' '}
            <a
              href="http://prodata.swmed.edu/"
              className="hover:text-blue-600 dark:hover:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              Grishin Lab
            </a>
            {' / '}
            <a
              href="https://www.hhmi.org/"
              className="hover:text-blue-600 dark:hover:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              HHMI
            </a>
            {' / '}
            <a
              href="https://www.utsouthwestern.edu/"
              className="hover:text-blue-600 dark:hover:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              UTSW
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

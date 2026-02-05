import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'ECOD documentation and help',
};

export default function DocumentationPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Documentation</h1>

      <div className="prose prose-blue max-w-none">
        {/* Introduction */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            What is ECOD?
          </h2>
          <p className="text-gray-600 mb-4">
            ECOD (Evolutionary Classification of Protein Domains) is a hierarchical
            classification of protein domains based on evolutionary relationships.
            It combines automated sequence and structure analysis with manual curation
            to organize protein domain structures.
          </p>
          <p className="text-gray-600">
            ECOD classifies domains into a five-level hierarchy: Architecture (A),
            X-group (possible homology), H-group (homology), T-group (topology),
            and F-group (family).
          </p>
        </section>

        {/* Classification Hierarchy */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Classification Hierarchy
          </h2>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-medium text-purple-800">A - Architecture</h3>
              <p className="text-sm text-gray-600">
                The highest level grouping based on overall protein fold architecture.
                Domains in the same architecture share similar overall shape.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-blue-800">X - X-group (Possible Homology)</h3>
              <p className="text-sm text-gray-600">
                Domains that may share an evolutionary origin but where evidence
                is not conclusive. Often based on structural similarity.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-green-800">H - H-group (Homology)</h3>
              <p className="text-sm text-gray-600">
                Domains with confirmed evolutionary relationship based on sequence
                similarity, structural similarity, or functional evidence.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-yellow-800">T - T-group (Topology)</h3>
              <p className="text-sm text-gray-600">
                Domains with similar structural topology. Groups within an H-group
                that share the same arrangement of secondary structure elements.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-orange-800">F - F-group (Family)</h3>
              <p className="text-sm text-gray-600">
                Closely related domains with high sequence similarity, typically
                sharing the same function.
              </p>
            </div>
          </div>
        </section>

        {/* Domain IDs */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Domain Identifiers
          </h2>

          <h3 className="font-medium text-gray-900 mt-4 mb-2">UID (Unique Identifier)</h3>
          <p className="text-gray-600 mb-4">
            A numeric identifier unique to each domain. UIDs are 6-9 digit numbers
            that serve as the primary key for domain lookups.
          </p>

          <h3 className="font-medium text-gray-900 mt-4 mb-2">ECOD Domain ID</h3>
          <p className="text-gray-600 mb-4">
            A human-readable identifier in the format <code className="bg-gray-100 px-1 rounded">e[pdb_id][chain][domain_number]</code>.
            For example, <code className="bg-gray-100 px-1 rounded">e1abcA1</code> refers to
            the first domain on chain A of PDB structure 1abc.
          </p>

          <h3 className="font-medium text-gray-900 mt-4 mb-2">Classification ID</h3>
          <p className="text-gray-600">
            Hierarchical IDs use dot notation, e.g., <code className="bg-gray-100 px-1 rounded">1.2.3.4</code>
            represents X-group 1, H-group 2, T-group 3, F-group 4.
          </p>
        </section>

        {/* Data Sources */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Data Sources
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>
              <strong>Experimental structures</strong> - From the RCSB Protein Data Bank (PDB)
            </li>
            <li>
              <strong>Computed models</strong> - From the AlphaFold Protein Structure Database
            </li>
            <li>
              <strong>Sequence data</strong> - From UniProt
            </li>
          </ul>
        </section>

        {/* Searching */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Searching ECOD
          </h2>
          <p className="text-gray-600 mb-4">
            You can search ECOD using various identifiers:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li><strong>UID</strong> - 6-9 digit numeric identifier</li>
            <li><strong>ECOD Domain ID</strong> - e.g., e1abcA1</li>
            <li><strong>PDB ID</strong> - 4-character PDB code</li>
            <li><strong>UniProt Accession</strong> - e.g., P12345</li>
            <li><strong>Keyword</strong> - Search by protein name or description</li>
          </ul>
        </section>

        {/* API */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            API Access
          </h2>
          <p className="text-gray-600 mb-4">
            ECOD provides a REST API for programmatic access to the database.
            API documentation will be available soon.
          </p>
        </section>

        {/* Citation */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Citation
          </h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              Cheng H, Schaeffer RD, Liao Y, Kinch LN, Pei J, Shi S, Kim BH, Grishin NV.
              ECOD: An evolutionary classification of protein domains.
              <em>PLoS Comput Biol.</em> 2014;10(12):e1003926.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Contact
          </h2>
          <p className="text-gray-600">
            For questions or feedback, please contact the{' '}
            <a
              href="http://prodata.swmed.edu/"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Grishin Lab
            </a>{' '}
            at UT Southwestern Medical Center.
          </p>
        </section>
      </div>
    </div>
  );
}

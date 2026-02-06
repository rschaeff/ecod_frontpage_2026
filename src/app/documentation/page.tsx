import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation - ECOD',
  description: 'ECOD classification hierarchy, search guide, data formats, and API documentation',
};

export default function DocumentationPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Documentation</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Guide to the ECOD classification system, search tools, and data formats.
      </p>

      {/* Table of Contents */}
      <nav className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 mb-10 border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Contents</h2>
        <ul className="space-y-1.5 text-sm">
          <li><a href="#about" className="text-blue-600 dark:text-blue-400 hover:underline">About ECOD</a></li>
          <li><a href="#hierarchy" className="text-blue-600 dark:text-blue-400 hover:underline">Classification Hierarchy</a></li>
          <li><a href="#identifiers" className="text-blue-600 dark:text-blue-400 hover:underline">Domain Identifiers</a></li>
          <li><a href="#searching" className="text-blue-600 dark:text-blue-400 hover:underline">Searching ECOD</a></li>
          <li><a href="#data-formats" className="text-blue-600 dark:text-blue-400 hover:underline">Data Formats</a></li>
          <li><a href="#api" className="text-blue-600 dark:text-blue-400 hover:underline">API Access</a></li>
          <li><a href="#citation" className="text-blue-600 dark:text-blue-400 hover:underline">Citation</a></li>
          <li><a href="#contact" className="text-blue-600 dark:text-blue-400 hover:underline">Contact</a></li>
        </ul>
      </nav>

      {/* About ECOD */}
      <section id="about" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">About ECOD</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          ECOD (Evolutionary Classification of Protein Domains) is a hierarchical
          classification of protein domains according to their evolutionary relationships.
          It combines automated sequence and structure analysis with manual curation
          to organize protein domain structures into a five-level hierarchy.
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          ECOD integrates domain classifications from both experimental structures in the{' '}
          <a href="https://www.rcsb.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Protein Data Bank</a>{' '}
          and computationally predicted structures from the{' '}
          <a href="https://alphafold.ebi.ac.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">AlphaFold Protein Structure Database</a>,
          covering 48 reference proteomes.
        </p>
      </section>

      {/* Classification Hierarchy */}
      <section id="hierarchy" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Classification Hierarchy</h2>

        <div className="md:flex md:gap-8">
          <div className="md:flex-1">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ECOD organizes protein domains into five hierarchical levels, from broad architectural
              similarity to close evolutionary families.
            </p>

            <div className="space-y-5">
              <HierarchyLevel
                level="A"
                name="Architecture"
                color="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                description="Architecture groups domains with similar secondary structure compositions and geometric shapes."
              />
              <HierarchyLevel
                level="X"
                name="X-group (Possible Homology)"
                color="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                description="X-group groups domains that are possible homologs with some yet inadequate evidence to support the homology relationships. In practice, they frequently share structural similarity."
              />
              <HierarchyLevel
                level="H"
                name="H-group (Homology)"
                color="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                description="H-group groups domains that are thought to be homologous based on various considerations, such as high sequence or structure scores, functional similarity, unusual features, and literature."
              />
              <HierarchyLevel
                level="T"
                name="T-group (Topology)"
                color="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                description="T-group groups domains with similar topological connections. Homologs with distinct topologies are separated in different T-groups under the same H-group."
              />
              <HierarchyLevel
                level="F"
                name="F-group (Family)"
                color="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                description="F-group groups domains with significant sequence similarity in a family. Currently, F-groups consist of a large proportion of mapped Pfam families and some HHsearch-based clusters."
              />
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Provisional Representative</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                An automatically assigned domain is designated as a provisional representative
                when the F-group does not contain any manual representative. These are marked
                with an asterisk (*) in the tree view.
              </p>
            </div>
          </div>

          <div className="mt-6 md:mt-0 md:w-80 shrink-0">
            <Image
              src="/images/Figure2_Levels.png"
              alt="ECOD classification hierarchy levels showing the relationship between Architecture, X-group, H-group, T-group, and F-group"
              width={548}
              height={800}
              className="rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              ECOD hierarchical levels (from Cheng et al., 2014)
            </p>
          </div>
        </div>
      </section>

      {/* Domain Identifiers */}
      <section id="identifiers" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Domain Identifiers</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">UID (Unique Identifier)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              A numeric identifier unique to each domain. UIDs are 6&ndash;9 digit numbers
              that serve as the primary key for domain lookups (e.g., <Code>002083261</Code>).
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">ECOD Domain ID</h3>
            <p className="text-gray-600 dark:text-gray-400">
              A human-readable identifier derived from the source structure.
              For experimental structures the format is <Code>e[pdb_id][chain][domain_number]</Code> &mdash;
              e.g., <Code>e1abcA1</Code> refers to the first domain on chain A of PDB structure 1abc.
              For AlphaFold models, the format uses the UniProt accession.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Classification ID</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Hierarchical IDs use dot notation. For example, <Code>1.2.3.4</Code> represents
              X-group 1, H-group 1.2, T-group 1.2.3, F-group 1.2.3.4.
              The number of dots indicates the level: 0 dots = X-group, 1 = H-group, 2 = T-group, 3 = F-group.
            </p>
          </div>
        </div>
      </section>

      {/* Searching ECOD */}
      <section id="searching" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Searching ECOD</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ECOD supports several search methods. The main search bar auto-detects the query type.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Method</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Example</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">UID</td>
                <td className="px-4 py-3"><Code>002083261</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Directly opens the domain detail page</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Domain ID</td>
                <td className="px-4 py-3"><Code>e1abcA1</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">ECOD domain identifier</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">PDB ID</td>
                <td className="px-4 py-3"><Code>1abc</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Shows all domains from a PDB structure</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">UniProt</td>
                <td className="px-4 py-3"><Code>P12345</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">UniProt accession search</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Cluster ID</td>
                <td className="px-4 py-3"><Code>1.2.3</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Browse domains in a classification group</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Keyword</td>
                <td className="px-4 py-3"><Code>kinase</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Searches cluster names and protein annotations</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-8 mb-3">Sequence Search (BLAST)</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Find ECOD domains with similar protein sequences using BLASTP. Paste a FASTA sequence
          on the home page or use the dedicated{' '}
          <Link href="/search/blast" className="text-blue-600 dark:text-blue-400 hover:underline">BLAST search page</Link>.
          Searches run against the ECOD representative domain database.
        </p>

        <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-6 mb-3">Structure Search (Foldseek)</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Find ECOD domains with similar 3D folds by uploading a PDB or mmCIF file.
          Uses{' '}
          <a href="https://github.com/steineggerlab/foldseek" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Foldseek</a>{' '}
          for fast structural alignment. See the{' '}
          <Link href="/search/foldseek" className="text-blue-600 dark:text-blue-400 hover:underline">structure search page</Link>.
        </p>

        <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-6 mb-3">Advanced Taxonomic Search</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Filter domains by superkingdom, taxonomic rank, structure source (PDB/AlphaFold),
          and protein name. See the{' '}
          <Link href="/search/advanced" className="text-blue-600 dark:text-blue-400 hover:underline">advanced search page</Link>.
        </p>
      </section>

      {/* Data Formats */}
      <section id="data-formats" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Formats</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Files available on the{' '}
          <Link href="/distribution" className="text-blue-600 dark:text-blue-400 hover:underline">download page</Link>{' '}
          use the following formats:
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">domains.txt</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Tab-separated file with one domain per line. Columns include UID, ECOD domain ID,
              classification hierarchy (A/X/H/T/F), source PDB/UniProt identifier, chain,
              residue range, and protein annotation.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">hierarchy.txt</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Tab-separated file describing the A/X/H/T/F group tree. Each line gives a group ID,
              its parent, level, and name.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">FASTA files (.fa)</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Standard FASTA-format protein sequences for all domains. Headers contain
              the ECOD domain ID and classification.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Clustering representatives (F40/F70/F99)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Subsets of domains selected as cluster representatives at 40%, 70%, and 99% sequence
              identity thresholds. Useful for reducing redundancy in analyses.
            </p>
          </div>
        </div>
      </section>

      {/* API Access */}
      <section id="api" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">API Access</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ECOD provides REST API endpoints for programmatic access. All endpoints return JSON.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Endpoint</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/domain/[uid]</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Domain details and classification</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/domain/[uid]/pdb</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Pre-cut domain PDB coordinates (experimental structures only)</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/domain/[uid]/fasta</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Domain FASTA sequence (experimental structures only)</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/search?q=[query]</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Search domains (auto-detects query type)</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/tree?parentId=[id]</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Classification tree children</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3"><Code>/api/stats</Code></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Database statistics</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Citation */}
      <section id="citation" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Citation</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          If you use ECOD in your research, please cite:
        </p>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 mb-2">
              Most Recent
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Schaeffer RD, Medvedev KE, Andreeva A, Chuguransky SR, Pinto BL, Zhang J, Cong Q, Bateman A, Grishin NV. (2025)
              ECOD: integrating classifications of protein domains from experimental and predicted structures.{' '}
              <em>Nucleic Acids Research</em>, gkae1029.{' '}
              <a href="https://doi.org/10.1093/nar/gkae1029" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                doi:10.1093/nar/gkae1029
              </a>
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Schaeffer RD, Liao Y, Cheng H, Grishin NV. (2017)
              ECOD: new developments in the evolutionary classification of domains.{' '}
              <em>Nucleic Acids Research</em>, 45(D1): D296-D302.{' '}
              <a href="https://doi.org/10.1093/nar/gkw1137" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                doi:10.1093/nar/gkw1137
              </a>
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Cheng H, Schaeffer RD, Liao Y, Kinch LN, Pei J, Shi S, Kim BH, Grishin NV. (2014)
              ECOD: An evolutionary classification of protein domains.{' '}
              <em>PLoS Comput Biol</em>, 10(12): e1003926.{' '}
              <a href="https://doi.org/10.1371/journal.pcbi.1003926" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                doi:10.1371/journal.pcbi.1003926
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Contact</h2>
        <p className="text-gray-600 dark:text-gray-400">
          For questions, feedback, or to report issues, email{' '}
          <a href="mailto:ecod.database@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">
            ecod.database@gmail.com
          </a>.
          ECOD is developed and maintained by the{' '}
          <a href="http://prodata.swmed.edu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
            Grishin Lab
          </a>{' '}
          at UT Southwestern Medical Center.
        </p>
      </section>
    </div>
  );
}

function HierarchyLevel({
  level,
  name,
  color,
  description,
}: {
  level: string;
  name: string;
  color: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm shrink-0 ${color}`}>
        {level}
      </span>
      <div>
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{name}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
      {children}
    </code>
  );
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download',
  description: 'Download ECOD domain classifications and data',
};

export default function DistributionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Download ECOD Data</h1>

      <p className="text-gray-600 mb-8">
        Download the complete ECOD classification data in various formats.
        Data is updated weekly with new PDB releases.
      </p>

      {/* Current Version */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Version</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-2xl font-bold text-blue-600">—</p>
              <p className="text-sm text-gray-500">Version will be loaded from API</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DownloadCard
              title="Full Dataset"
              description="Complete ECOD classification with all domains"
              filename="ecod.latest.domains.txt"
              disabled
            />
            <DownloadCard
              title="F40 Representatives"
              description="Non-redundant set at 40% sequence identity"
              filename="ecod.latest.F40.domains.txt"
              disabled
            />
            <DownloadCard
              title="F70 Representatives"
              description="Non-redundant set at 70% sequence identity"
              filename="ecod.latest.F70.domains.txt"
              disabled
            />
            <DownloadCard
              title="F99 Representatives"
              description="Non-redundant set at 99% sequence identity"
              filename="ecod.latest.F99.domains.txt"
              disabled
            />
          </div>
        </div>
      </section>

      {/* File Format */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">File Format</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-4">
            Domain files are tab-separated with the following columns:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-900">Column</th>
                  <th className="text-left py-2 font-medium text-gray-900">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">uid</td>
                  <td className="py-2">Unique identifier</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">ecod_domain_id</td>
                  <td className="py-2">ECOD domain identifier</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">pdb_id</td>
                  <td className="py-2">PDB identifier</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">chain</td>
                  <td className="py-2">Chain identifier</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">range</td>
                  <td className="py-2">Residue range</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono">x_id, h_id, t_id, f_id</td>
                  <td className="py-2">Classification hierarchy IDs</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono">x_name, h_name, t_name, f_name</td>
                  <td className="py-2">Classification hierarchy names</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Previous Versions */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Previous Versions</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">
            Previous version list will be loaded from the API.
          </p>
        </div>
      </section>
    </div>
  );
}

function DownloadCard({
  title,
  description,
  filename,
  disabled = false,
}: {
  title: string;
  description: string;
  filename: string;
  disabled?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white hover:border-blue-300'}`}>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      <button
        disabled={disabled}
        className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
      >
        {filename}
      </button>
    </div>
  );
}

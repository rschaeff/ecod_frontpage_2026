'use client';

import { useState } from 'react';
import Link from 'next/link';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const BASE_URL = typeof window !== 'undefined' ? window.location.origin + basePath : '';

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  parameters?: { name: string; type: string; description: string; required?: boolean }[];
  responseExample: string;
  tryItDefault?: string;
}

function Endpoint({ method, path, description, parameters, responseExample, tryItDefault }: EndpointProps) {
  const [tryUrl, setTryUrl] = useState(tryItDefault || '');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTry = async () => {
    if (!tryUrl) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch(tryUrl);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      } else {
        const text = await res.text();
        setResponse(text.length > 2000 ? text.substring(0, 2000) + '\n...(truncated)' : text);
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
            {method}
          </span>
          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">{path}</code>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {parameters && parameters.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Parameters</h4>
            <div className="space-y-1.5">
              {parameters.map((p) => (
                <div key={p.name} className="flex items-baseline gap-2 text-sm">
                  <code className="font-mono text-gray-900 dark:text-gray-100">{p.name}</code>
                  <span className="text-gray-400 dark:text-gray-500">{p.type}</span>
                  {p.required && <span className="text-xs text-red-500 dark:text-red-400">required</span>}
                  <span className="text-gray-600 dark:text-gray-400">&mdash; {p.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Example Response</h4>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
            {responseExample}
          </pre>
        </div>

        {/* Try It */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Try It</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={tryUrl}
              onChange={(e) => setTryUrl(e.target.value)}
              placeholder="Enter full URL..."
              className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={handleTry}
              disabled={loading || !tryUrl}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Send'}
            </button>
          </div>
          {response && (
            <pre className="mt-3 bg-gray-900 dark:bg-gray-950 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {response}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 rounded-t-lg">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-b-lg text-sm overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

export default function ApiDocumentationPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/documentation" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          &larr; Documentation
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">API Reference</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Programmatic access to the ECOD domain classification database. All endpoints return JSON and are publicly
        accessible with CORS enabled.
      </p>

      {/* Overview */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Overview</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100 w-28 shrink-0">Base URL</span>
            <code className="font-mono text-gray-700 dark:text-gray-300">{BASE_URL || 'https://prodata.swmed.edu/ecod2'}/api/v1</code>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100 w-28 shrink-0">Format</span>
            <span className="text-gray-600 dark:text-gray-400">JSON (application/json)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100 w-28 shrink-0">Auth</span>
            <span className="text-gray-600 dark:text-gray-400">None required. All endpoints are public.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100 w-28 shrink-0">Rate Limit</span>
            <span className="text-gray-600 dark:text-gray-400">100 requests per minute per IP address. Returns HTTP 429 with <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Retry-After</code> header when exceeded.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100 w-28 shrink-0">CORS</span>
            <span className="text-gray-600 dark:text-gray-400">Enabled for all origins. Safe to call from browser JavaScript.</span>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <nav className="mb-10 bg-gray-50 dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Endpoints</h2>
        <ul className="space-y-1.5 text-sm">
          <li><a href="#health" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/health</a> &mdash; Service health check</li>
          <li><a href="#domain" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/:uid</a> &mdash; Domain details by UID</li>
          <li><a href="#domain-pdb" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/:uid/pdb</a> &mdash; Domain PDB coordinates</li>
          <li><a href="#domain-fasta" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/:uid/fasta</a> &mdash; Domain FASTA sequence</li>
          <li><a href="#uniprot" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/uniprot/:acc</a> &mdash; Domains by UniProt accession</li>
          <li><a href="#pdb" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/pdb/:pdbId</a> &mdash; Domains by PDB entry</li>
          <li><a href="#pfam" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/pfam/:acc</a> &mdash; Domains by Pfam accession</li>
          <li><a href="#clan" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/clan/:acc</a> &mdash; Domains by Pfam clan</li>
          <li><a href="#unclassified-global" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/unclassified</a> &mdash; All unclassified domains (global)</li>
          <li><a href="#unclassified" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/unclassified/:groupId</a> &mdash; Unclassified domains in an ECOD group</li>
          <li><a href="#unclassified-fasta" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/unclassified/fasta</a> &mdash; Bulk FASTA for all unclassified domains</li>
          <li><a href="#unclassified-group-fasta" className="text-blue-600 dark:text-blue-400 hover:underline">GET /api/v1/domains/unclassified/:groupId/fasta</a> &mdash; Bulk FASTA for unclassified domains in a group</li>
        </ul>
      </nav>

      {/* Endpoints */}
      <div className="space-y-10">
        <section id="health">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Health Check</h2>
          <Endpoint
            method="GET"
            path="/api/v1/health"
            description="Returns service status and database connectivity. Returns HTTP 503 if the database is unreachable."
            responseExample={`{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "latency_ms": 22
}`}
            tryItDefault={`${BASE_URL}/api/v1/health`}
          />
        </section>

        <section id="domain">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Get Domain</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/:uid"
            description="Retrieve a single domain by its numeric UID, including full classification hierarchy and links to downloadable files."
            parameters={[
              { name: 'uid', type: 'integer', description: 'Domain unique identifier (0 or greater)', required: true },
            ]}
            responseExample={`{
  "uid": 2083261,
  "ecod_domain_id": "e2nmzA1",
  "type": "experimental structure",
  "source_id": "2nmz_A",
  "uniprot_acc": "P00519",
  "chain_id": "A",
  "range": "242-502",
  "classification": {
    "architecture": "beta barrels",
    "x_group": "Cradle loop barrel",
    "h_group": "Protein kinase-like (PK-like)",
    "t_group": "Protein kinase-like (PK-like)",
    "family": "Protein kinases, catalytic subunit"
  },
  "is_representative": false,
  "is_manual": true,
  "files": {
    "pdb": "/api/v1/domains/2083261/pdb",
    "fasta": "/api/v1/domains/2083261/fasta"
  }
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/2083261`}
          />
        </section>

        <section id="domain-pdb">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Download Domain PDB</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/:uid/pdb"
            description="Download pre-cut PDB coordinates for a domain. Returns the atomic coordinates for just the domain residues extracted from the parent structure. Content-Type: chemical/x-pdb."
            parameters={[
              { name: 'uid', type: 'integer', description: 'Domain unique identifier', required: true },
            ]}
            responseExample={`HEADER    ecod_002083261
ATOM      1  N   GLU A 242      34.662  28.228  52.640  1.00 38.22           N
ATOM      2  CA  GLU A 242      34.434  29.524  52.000  1.00 37.63           C
...`}
            tryItDefault={`${BASE_URL}/api/v1/domains/2083261/pdb`}
          />
        </section>

        <section id="domain-fasta">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Download Domain FASTA</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/:uid/fasta"
            description="Download FASTA-format protein sequence for a domain. Content-Type: text/plain."
            parameters={[
              { name: 'uid', type: 'integer', description: 'Domain unique identifier', required: true },
            ]}
            responseExample={`>ecod_002083261 e2nmzA1 242-502
EEALQRPVASDFEPQGLSEAARWNSKENLLAGPSENDPNL...`}
            tryItDefault={`${BASE_URL}/api/v1/domains/2083261/fasta`}
          />
        </section>

        <section id="uniprot">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Domains by UniProt</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/uniprot/:acc"
            description="Retrieve all ECOD domains associated with a UniProt accession. Returns both experimental and AlphaFold domains."
            parameters={[
              { name: 'acc', type: 'string', description: 'UniProt accession (e.g., P00519)', required: true },
            ]}
            responseExample={`{
  "uniprot_acc": "P00519",
  "domain_count": 138,
  "domains": [
    {
      "uid": 2083261,
      "ecod_domain_id": "e2nmzA1",
      "type": "experimental structure",
      "source_id": "2nmz_A",
      "chain_id": "A",
      "range": "242-502",
      "classification": {
        "architecture": "beta barrels",
        "x_group": "Cradle loop barrel",
        "h_group": "Protein kinase-like (PK-like)",
        "t_group": "Protein kinase-like (PK-like)",
        "family": "Protein kinases, catalytic subunit"
      },
      "is_representative": false,
      "is_manual": true
    }
  ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/uniprot/P00519`}
          />
        </section>

        <section id="pdb">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Domains by PDB</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/pdb/:pdbId"
            description="Retrieve all ECOD domains from a PDB entry. The PDB ID is case-insensitive."
            parameters={[
              { name: 'pdbId', type: 'string', description: 'PDB identifier (e.g., 2nmz)', required: true },
            ]}
            responseExample={`{
  "pdb_id": "2nmz",
  "domain_count": 2,
  "domains": [
    {
      "uid": 2083261,
      "ecod_domain_id": "e2nmzA1",
      "type": "experimental structure",
      "source_id": "2nmz_A",
      "chain_id": "A",
      "range": "242-502",
      "classification": {
        "architecture": "beta barrels",
        "x_group": "Cradle loop barrel",
        "h_group": "Protein kinase-like (PK-like)",
        "t_group": "Protein kinase-like (PK-like)",
        "family": "Protein kinases, catalytic subunit"
      },
      "is_representative": false,
      "is_manual": true
    }
  ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/pdb/2nmz`}
          />
        </section>

        <section id="pfam">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Domains by Pfam</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/pfam/:acc"
            description="Retrieve all ECOD domains in F-groups mapped to a Pfam accession. Includes Pfam metadata, clan membership, and the list of matching ECOD F-groups."
            parameters={[
              { name: 'acc', type: 'string', description: 'Pfam accession (e.g., PF00077)', required: true },
            ]}
            responseExample={`{
  "pfam_acc": "PF00077",
  "pfam_id": "Toxin_1",
  "pfam_description": "Scorpion short toxin, BmKa1",
  "clan": { "acc": "CL0054", "name": "Knottin_1" },
  "fgroup_count": 2,
  "fgroups": [
    { "id": "6.1.1.4", "name": "Scorpion short toxin" }
  ],
  "domain_count": 245,
  "domains": [
    {
      "uid": 2083261,
      "ecod_domain_id": "e2nmzA1",
      "type": "experimental structure",
      "classification": { ... }
    }
  ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/pfam/PF00077`}
          />
        </section>

        <section id="clan">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Domains by Pfam Clan</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/clan/:acc"
            description="Retrieve all ECOD domains mapped to any Pfam family within a clan. Returns the clan's member Pfam families, matching ECOD F-groups, and all associated domains."
            parameters={[
              { name: 'acc', type: 'string', description: 'Pfam clan accession (e.g., CL0054)', required: true },
            ]}
            responseExample={`{
  "clan_acc": "CL0054",
  "clan_name": "Knottin_1",
  "pfam_count": 38,
  "pfam_families": [
    { "acc": "PF00077", "id": "Toxin_1", "description": "Scorpion short toxin" },
    { "acc": "PF07740", "id": "Toxin_2", "description": "Scorpion short toxin" }
  ],
  "fgroup_count": 15,
  "fgroups": [
    { "id": "6.1.1.4", "name": "Scorpion short toxin" }
  ],
  "domain_count": 1832,
  "domains": [ ... ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/clan/CL0054`}
          />
        </section>

        <section id="unclassified-global">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">All Unclassified Domains</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/unclassified"
            description="Retrieve all unclassified domains across ECOD — in placeholder .0 families or families with no Pfam mapping. Paginated."
            parameters={[
              { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
              { name: 'limit', type: 'integer', description: 'Results per page, max 1000 (default: 100)' },
              { name: 'no_pfam_only', type: 'boolean', description: 'If true, only return domains in families with no Pfam mapping (excludes .0 filter)' },
            ]}
            responseExample={`{
  "group_id": null,
  "group_level": "global",
  "filter": "unclassified",
  "filter_description": "All domains in .0 (placeholder) F-groups or F-groups with no Pfam mapping",
  "unclassified_fgroup_count": 3027,
  "unclassified_fgroups": [
    { "id": "1001.1.1.0", "name": null, "pfam_acc": null },
    { "id": "1002.1.1.0", "name": null, "pfam_acc": null }
  ],
  "domain_count": 317416,
  "page": 1,
  "page_size": 100,
  "total_pages": 3175,
  "domains": [ ... ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/unclassified?limit=10`}
          />
        </section>

        <section id="unclassified">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Unclassified Domains by Group</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/unclassified/:groupId"
            description="Retrieve domains within an ECOD group that are unclassified — in placeholder .0 families or families with no Pfam mapping. Works at any hierarchy level (X, H, T, or F group)."
            parameters={[
              { name: 'groupId', type: 'string', description: 'ECOD group ID, dot-separated (e.g., 1 for X-group, 1.1 for H-group)', required: true },
              { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
              { name: 'limit', type: 'integer', description: 'Results per page, max 1000 (default: 100)' },
              { name: 'no_pfam_only', type: 'boolean', description: 'If true, only return domains in families with no Pfam mapping (excludes .0 filter)' },
            ]}
            responseExample={`{
  "group_id": "1.1",
  "group_level": "H-group",
  "filter": "unclassified",
  "filter_description": "Domains in .0 (placeholder) F-groups or F-groups with no Pfam mapping",
  "unclassified_fgroup_count": 3,
  "unclassified_fgroups": [
    { "id": "1.1.1.0", "name": "Unclassified", "pfam_acc": null },
    { "id": "1.1.4.0", "name": "Unclassified", "pfam_acc": null }
  ],
  "domain_count": 487,
  "page": 1,
  "page_size": 100,
  "total_pages": 5,
  "domains": [ ... ]
}`}
            tryItDefault={`${BASE_URL}/api/v1/domains/unclassified/1.1`}
          />
        </section>

        <section id="unclassified-fasta">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Bulk FASTA: All Unclassified</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/unclassified/fasta"
            description="Download a concatenated FASTA file containing sequences for all unclassified domains across ECOD. Streamed — suitable for large downloads. Returns text/plain."
            parameters={[
              { name: 'no_pfam_only', type: 'boolean', description: 'If true, only include domains in families with no Pfam mapping' },
            ]}
            responseExample={`>e2e7zA4 uid:001685572 range:A:4-61 assignment:1001.1.1.0
KKHVVCQSCDINCVVEAEVKADGKIQTKSISEPHPTTPPNSICMKSVNADTIRTHKDR
>e2ivfA4 uid:001685808 range:A:65-138 assignment:1002.1.1.0
EDIYRKEWKWDKVNWGSHLNICWPQGSCKFYVYVRNGIVWREEQAAQTPACNVDYVDYNPLGCQKGSAFNNNLY
...`}
            tryItDefault={`${BASE_URL}/api/v1/domains/unclassified/fasta`}
          />
        </section>

        <section id="unclassified-group-fasta">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Bulk FASTA: Unclassified by Group</h2>
          <Endpoint
            method="GET"
            path="/api/v1/domains/unclassified/:groupId/fasta"
            description="Download a concatenated FASTA file containing sequences for unclassified domains within a specific ECOD group. Streamed — suitable for large downloads. Returns text/plain."
            parameters={[
              { name: 'groupId', type: 'string', description: 'ECOD group ID, dot-separated (e.g., 1, 1.1, 1.1.1)', required: true },
              { name: 'no_pfam_only', type: 'boolean', description: 'If true, only include domains in families with no Pfam mapping' },
            ]}
            responseExample={`>e1a0tA1 uid:000012345 range:A:1-120 assignment:1.1.1.0
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSY...
>e1b0zA2 uid:000023456 range:A:55-180 assignment:1.1.4.0
KALTARQQEVFDLIRDHISQTGMPPTRAEIAQRLGFRSPN...
...`}
            tryItDefault={`${BASE_URL}/api/v1/domains/unclassified/1/fasta`}
          />
        </section>
      </div>

      {/* Error Responses */}
      <section className="mt-12 mb-10">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Error Responses</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
          All errors return a JSON object with an <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">error</code> field.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Meaning</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono">400</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Invalid parameter</td>
                <td className="px-4 py-3 font-mono text-xs">{`{"error": "Invalid UID"}`}</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono">404</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Resource not found</td>
                <td className="px-4 py-3 font-mono text-xs">{`{"error": "Domain not found"}`}</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono">429</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Rate limit exceeded</td>
                <td className="px-4 py-3 font-mono text-xs">{`{"error": "Too many requests..."}`}</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono">500</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Server error</td>
                <td className="px-4 py-3 font-mono text-xs">{`{"error": "Failed to fetch domain"}`}</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono">503</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Database unavailable</td>
                <td className="px-4 py-3 font-mono text-xs">{`{"status": "degraded", ...}`}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Code Examples */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Code Examples</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Python</h3>
            <CodeBlock
              language="python"
              code={`import requests

BASE = "https://prodata.swmed.edu/ecod2/api/v1"

# Get all domains for a UniProt accession
resp = requests.get(f"{BASE}/domains/uniprot/P00519")
data = resp.json()
print(f"Found {data['domain_count']} domains")

for d in data["domains"]:
    print(f"  {d['ecod_domain_id']}  {d['range']}  {d['classification']['family']}")

# Download a domain PDB file
pdb = requests.get(f"{BASE}/domains/2083261/pdb")
with open("ecod_2083261.pdb", "w") as f:
    f.write(pdb.text)

# Find all domains mapped to a Pfam family
resp = requests.get(f"{BASE}/domains/pfam/PF00077")
data = resp.json()
print(f"PF00077 ({data['pfam_id']}): {data['domain_count']} domains in {data['fgroup_count']} F-groups")

# Find all domains in a Pfam clan
resp = requests.get(f"{BASE}/domains/clan/CL0054")
data = resp.json()
print(f"Clan {data['clan_name']}: {data['pfam_count']} Pfam families, {data['domain_count']} domains")

# Get unclassified domains in an H-group (paginated)
resp = requests.get(f"{BASE}/domains/unclassified/1.1", params={"limit": 50})
data = resp.json()
print(f"{data['domain_count']} unclassified domains in {data['unclassified_fgroup_count']} F-groups")

# Download bulk FASTA for all unclassified domains
resp = requests.get(f"{BASE}/domains/unclassified/fasta", stream=True)
with open("ecod_unclassified.fasta", "wb") as f:
    for chunk in resp.iter_content(chunk_size=8192):
        f.write(chunk)

# Download bulk FASTA for a specific X-group
resp = requests.get(f"{BASE}/domains/unclassified/1/fasta")
with open("ecod_unclassified_xgroup1.fasta", "w") as f:
    f.write(resp.text)`}
            />
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">JavaScript / Node.js</h3>
            <CodeBlock
              language="javascript"
              code={`const BASE = "https://prodata.swmed.edu/ecod2/api/v1";

// Get domain details
const resp = await fetch(\`\${BASE}/domains/2083261\`);
const domain = await resp.json();
console.log(domain.classification.family);
// => "Protein kinases, catalytic subunit"

// Get all domains for a UniProt accession
const unp = await fetch(\`\${BASE}/domains/uniprot/P00519\`);
const { domains } = await unp.json();
console.log(\`Found \${domains.length} domains\`);

// Download FASTA
const fasta = await fetch(\`\${BASE}/domains/2083261/fasta\`);
console.log(await fasta.text());`}
            />
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">curl</h3>
            <CodeBlock
              language="bash"
              code={`# Domain details
curl https://prodata.swmed.edu/ecod2/api/v1/domains/2083261

# All domains for a PDB entry
curl https://prodata.swmed.edu/ecod2/api/v1/domains/pdb/2nmz

# Download domain PDB file
curl -o ecod_2083261.pdb https://prodata.swmed.edu/ecod2/api/v1/domains/2083261/pdb

# All domains for a UniProt accession
curl https://prodata.swmed.edu/ecod2/api/v1/domains/uniprot/P00519

# Domains mapped to a Pfam family
curl https://prodata.swmed.edu/ecod2/api/v1/domains/pfam/PF00077

# Domains in a Pfam clan
curl https://prodata.swmed.edu/ecod2/api/v1/domains/clan/CL0054

# All unclassified domains (paginated)
curl "https://prodata.swmed.edu/ecod2/api/v1/domains/unclassified?limit=50"

# Unclassified domains in X-group 1 (page 1, 50 per page)
curl "https://prodata.swmed.edu/ecod2/api/v1/domains/unclassified/1?limit=50"

# Bulk FASTA download — all unclassified domains
curl -o ecod_unclassified.fasta https://prodata.swmed.edu/ecod2/api/v1/domains/unclassified/fasta

# Bulk FASTA download — unclassified in X-group 1
curl -o ecod_unclassified_x1.fasta https://prodata.swmed.edu/ecod2/api/v1/domains/unclassified/1/fasta

# Health check
curl https://prodata.swmed.edu/ecod2/api/v1/health`}
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Questions about the API? Contact{' '}
            <a href="mailto:ecod.database@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              ecod.database@gmail.com
            </a>.
            For bulk data downloads, see the{' '}
            <Link href="/distribution" className="text-blue-600 dark:text-blue-400 hover:underline">
              distribution page
            </Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

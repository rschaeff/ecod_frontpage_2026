#!/usr/bin/env python3
"""Build the release index that the distribution page and API read.

Writes two documents into the distributions directory:

  releases-full.json  every release with its file list; read by
                      src/app/api/distributions/route.ts
  releases.json       the same without the per-release file lists, published
                      for scripted consumers, plus a detail_url pointing at
                      the full document

Reading one manifest replaces stat()-ing ~2,400 files over NFS on every cache
miss, and both documents come from this one scan, so the page and the published
index cannot drift apart.

Run it after every release, and after republishing any file of an existing
release -- the page has no fallback, so a release absent from the index is
absent from the site.

    ./scripts/build_releases_index.py --dry-run     # report, write nothing
    ./scripts/build_releases_index.py               # write both documents

Classification lives in KINDS below. A filename that matches nothing lands in
'other' rather than being dropped, so a new member shows up on the page as an
unlabelled file instead of silently disappearing. --strict turns that into an
error for the release being published -- run it after a release, where an
unrecognised name means KINDS needs a new entry. It ignores the older releases,
fourteen of whose files have never been classifiable.

Output is byte-identical to the index published on 2026-10-05, across all 239
releases and 2,328 files, so a first run changes nothing.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = 'http://prodata.swmed.edu/ecod/distributions/'
FULL_DOC = 'releases-full.json'
SUMMARY_DOC = 'releases.json'

NAMING_NOTE = (
    'Releases up to and including 292 are named ecod.develop<N>.*; releases '
    'from 293 onward are named ecod.v<N>[.<M>].*. The ecod.latest.* files are '
    'symlinks to the current release.'
)

# ecod.<release>.<member>, where <release> is develop<N>, v<N> or v<N>.<M>.
# The optional point release is matched greedily but only when what follows is
# numeric, so 'ecod.v295.F40.domains.txt' reads as release v295 member F40...,
# while 'ecod.v295.2.F40.domains.txt' reads as release v295.2.
RELEASE_FILE = re.compile(r'^ecod\.(develop\d+|v\d+(?:\.\d+)?)\.(.+)$')
ALIAS_FILE = re.compile(r'^ecod\.latest\.(.+)$')
# The representative set is a release-level partition and appears directly after
# the release token: ecod.v295.2.F40.domains.txt. It is NOT read from later in
# the name -- develop70's old 'ecod.develop70.domains.F40.txt' ordering is a
# different thing and carries no set in the published index.
REP_SET = re.compile(r'^(F40|F70|F99)(?:\.|$)')

# '**Release Date:** August 27, 2026' in RELEASE_NOTES_<REL>.md. The notes are
# authoritative for the release date: a file republished later (v295.2's domain
# tables were reissued with recomputed ligand columns) must not move the date.
NOTES_DATE = re.compile(r'\*\*Release Date:\*\*\s*(.+)')

# Member suffix -> (kind, description), first match wins, so the specific
# archive patterns must precede the loose ones they would also match.
# The descriptions are user-facing: they are what the page prints beside each
# file, so they name what the file IS, not what produced it.
KINDS: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r'(?:^|\.)blast_db\.tar\.gz$'),           'blast_db',           'Domain BLAST database (archive)'),
    (re.compile(r'(?:^|\.)chainwise_blast_db\.tar\.gz$'), 'chainwise_blast_db', 'Chain BLAST database (archive)'),
    (re.compile(r'(?:^|\.)foldseek_db\.tar\.gz$'),        'foldseek_db',        'Foldseek database'),
    (re.compile(r'(?:^|\.)hh?m_db\.tar\.gz$'),            'hhsuite_db',         'HH-suite profile database'),
    # Loose BLAST+ v5 index members: .phr .pin .psq .pdb .pot .ptf .pto .pjs .pal
    (re.compile(r'(?:^|\.)chainwise\.p[a-z]{2}$'),         'chainwise_blast_db', 'Chain BLAST database'),
    (re.compile(r'(?:^|\.)blast\.p[a-z]{2}$'),             'blast_db',           'BLAST database'),
    (re.compile(r'(?:^|\.)foldseek'),                      'foldseek_db',        'Foldseek database'),
    (re.compile(r'(?:^|\.)hh?m_db$'),                      'hhsuite_db',         'HH-suite profile database'),
    (re.compile(r'(?:^|\.)chainwise\.fa$'),                'chainwise',          'Chain sequences'),
    (re.compile(r'(?:^|\.)md5$'),                          'checksums',          'MD5 checksums'),
    (re.compile(r'(?:^|\.)hierarchy\.txt$'),               'hierarchy',          'Classification hierarchy'),
    (re.compile(r'(?:^|\.)f_id_pfam_acc\.txt$'),           'pfam_map',           'F-group to Pfam accession mapping'),
    (re.compile(r'(?:^|\.)names\.txt$'),                   'names',              'Domain index (uid, domain id, F-group)'),
    (re.compile(r'(?:^|\.)domains\.txt(?:\.original_pre_repair)?$'),
                                                            'domains',            'Domain table'),
    (re.compile(r'(?:^|\.)pdb\.tar\.gz$'),                'structures',         'Domain coordinate files'),
    (re.compile(r'(?:^|\.)fa$'),                           'sequences',          'Domain sequences'),
    # 'fasta.txt' and develop70's older 'fasta.<SET>.txt' ordering.
    (re.compile(r'(?:^|\.)fasta(?:\.F\d\d)?\.txt$'),        'sequences',          'Domain sequences'),
]


# Members that are deliberately unlabelled. They are published as 'other', which
# is what the index has always recorded for them, but they are known rather than
# unrecognised, so --strict does not flag them. The F-set coverage reports ship
# with every modern release.
ACCEPTED_OTHER: tuple[re.Pattern[str], ...] = (
    re.compile(r'(?:^|\.)pdb\.(?:empty|missing)\.tsv$'),
)


def classify(member: str) -> tuple[str, str]:
    for pattern, kind, description in KINDS:
        if pattern.search(member):
            return kind, description
    return 'other', 'Other'


def release_sort_key(release: str) -> tuple[int, int, int]:
    """develop releases before v releases, then by number and point release."""
    m = re.match(r'^(develop|v)(\d+)(?:\.(\d+))?$', release)
    if not m:
        return (0, 0, 0)
    prefix, number, point = m.groups()
    return (1 if prefix == 'v' else 0, int(number), int(point or 0))


def notes_path(dist_dir: Path, release: str) -> Path | None:
    """RELEASE_NOTES_V295_2.md / RELEASE_NOTES_V295.md for release v295[.2]."""
    for name in (f"RELEASE_NOTES_{release.upper().replace('.', '_')}.md",
                 f"RELEASE_NOTES_{release.upper()}.md"):
        candidate = dist_dir / name
        if candidate.is_file():
            return candidate
    return None


def release_date(dist_dir: Path, release: str, mtimes: list[float]) -> tuple[str, str]:
    """(date, date_source). The release notes win over file timestamps."""
    notes = notes_path(dist_dir, release)
    if notes:
        try:
            for line in notes.read_text(errors='replace').splitlines()[:40]:
                m = NOTES_DATE.search(line)
                if not m:
                    continue
                for fmt in ('%B %d, %Y', '%b %d, %Y', '%Y-%m-%d'):
                    try:
                        parsed = datetime.strptime(m.group(1).strip(), fmt)
                    except ValueError:
                        continue
                    return parsed.strftime('%Y-%m-%d'), 'release_notes'
        except OSError:
            pass
    # The domain table's own timestamp. It is the artifact the release exists to
    # publish, and it is what the published index records: dating a release by the
    # newest of ALL its files pulls develop118 from 2015-12-15 to 2016-01-21 on the
    # strength of an extra .pfam.txt added a month later, and by the oldest pulls
    # develop45 back to 2014-06-23 on one stale file. UTC, because local time moves
    # 52 of the 239 releases a day earlier -- the files were written after 19:00
    # Central.
    table = dist_dir / f'ecod.{release}.domains.txt'
    try:
        return (datetime.fromtimestamp(table.stat().st_mtime, timezone.utc)
                .strftime('%Y-%m-%d'), 'file_mtime')
    except OSError:
        pass
    newest = max(mtimes) if mtimes else 0.0
    return (datetime.fromtimestamp(newest, timezone.utc).strftime('%Y-%m-%d'),
            'file_mtime')


def read_checksums(dist_dir: Path, release: str) -> dict[str, str]:
    """ecod.<release>.md5 as {filename: md5}. Hashes are read, never computed:
    the checksum file is itself a published artifact and must agree with it."""
    path = dist_dir / f'ecod.{release}.md5'
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    try:
        for line in path.read_text(errors='replace').splitlines():
            parts = line.split()
            if len(parts) >= 2 and re.fullmatch(r'[0-9a-f]{32}', parts[0]):
                out[parts[-1].lstrip('*')] = parts[0]
    except OSError:
        pass
    return out


def scan(dist_dir: Path, strict: bool) -> tuple[list[dict], dict[str, str | None], list[tuple[str, str]]]:
    """Group the directory into releases, resolve the latest-* aliases."""
    releases: dict[str, list[dict]] = {}
    mtimes: dict[str, list[float]] = {}
    aliases: dict[str, str | None] = {}
    unknown: list[tuple[str, str]] = []

    with os.scandir(dist_dir) as entries:
        for entry in entries:
            name = entry.name

            # Any symlink in the directory is an alias, not a file of a release:
            # ecod.latest.* point into the current release, and ecod.v292.* are
            # the v-named aliases of the develop292 files from the rename. Both
            # are recorded and neither is counted again under its target's
            # release. A few ecod.latest.* entries are regular files rather than
            # symlinks (the BLAST .pal alias lists); they are still aliases, with
            # no target to report.
            is_alias_name = ALIAS_FILE.match(name) is not None
            if entry.is_symlink():
                try:
                    aliases[name] = Path(os.readlink(entry.path)).name
                except OSError:
                    aliases[name] = None
                continue
            if is_alias_name:
                aliases[name] = None
                continue

            match = RELEASE_FILE.match(name)
            if not match or not entry.is_file(follow_symlinks=False):
                continue

            release, member = match.group(1), match.group(2)
            kind, description = classify(member)
            if kind == 'other' and not any(r.search(member) for r in ACCEPTED_OTHER):
                unknown.append((release, name))

            stat = entry.stat()
            releases.setdefault(release, []).append({
                'name': name,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(
                    stat.st_mtime, timezone.utc).strftime('%Y-%m-%d'),
                'kind': kind,
                'description': description,
                **({'representative_set': m.group(1)} if (m := REP_SET.search(member)) else {}),
            })
            mtimes.setdefault(release, []).append(stat.st_mtime)

    ordered = sorted(releases, key=release_sort_key, reverse=True)
    current = ordered[0] if ordered else None

    # --strict guards the release being published, not the archive. Fourteen
    # historical files have never been classifiable (develop70's reordered names,
    # a one-off HMMER db, assorted Pfam working files) and never will be, so
    # checking every release would make the flag permanently red and useless.
    if strict:
        new_unknown = sorted(name for rel, name in unknown if rel == current)
        if new_unknown:
            raise SystemExit(
                f'{len(new_unknown)} file(s) of {current} match no entry in '
                f'KINDS and would be published as "Other":\n  '
                + '\n  '.join(new_unknown)
                + '\nAdd a KINDS entry, or an ACCEPTED_OTHER pattern if being '
                  'unlabelled is correct.'
            )

    out = []
    for release in ordered:
        files = releases[release]
        checksums = read_checksums(dist_dir, release)
        for f in files:
            if (digest := checksums.get(f['name'])):
                f['md5'] = digest
        files.sort(key=lambda f: f['name'])

        date, date_source = release_date(dist_dir, release, mtimes[release])
        number, point = release_sort_key(release)[1:]
        out.append({
            'release': release,
            'label': release.removeprefix('develop').removeprefix('v'),
            'naming': 'v' if release.startswith('v') else 'develop',
            'number': number,
            'point': point,
            'date': date,
            'date_source': date_source,
            'current': release == current,
            'file_count': len(files),
            'total_bytes': sum(f['size'] for f in files),
            'has': sorted({f['kind'] for f in files}),
            'files': files,
        })
    return out, aliases, unknown


def build(dist_dir: Path, strict: bool) -> tuple[dict, dict, list[tuple[str, str]]]:
    releases, aliases, unknown = scan(dist_dir, strict)
    dates = [r['date'] for r in releases if r['date']]
    head = {
        'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'base_url': BASE_URL,
        'current_release': next((r['release'] for r in releases if r['current']), None),
        'release_count': len(releases),
        'span': {'first': min(dates), 'last': max(dates)} if dates else None,
        'naming_note': NAMING_NOTE,
        'aliases': dict(sorted(aliases.items())),
    }
    full = {**head, 'releases': releases}
    summary = {
        **head,
        'releases': [{k: v for k, v in r.items() if k != 'files'} for r in releases],
        'detail_url': BASE_URL + FULL_DOC,
    }
    return full, summary, unknown


def write_atomic(path: Path, doc: dict) -> None:
    """Write via a temporary file in the same directory, then rename.

    The web server reads these while they are being rewritten, so a partially
    written document must never be visible under the real name -- the route
    treats a parse failure as "no releases" and the page empties out.
    """
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_text(json.dumps(doc, indent=2, sort_keys=False) + '\n')
    os.replace(tmp, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dist-dir', type=Path,
                        default=Path(os.environ.get('DIST_DIR', '/data/ECOD0/html/distributions')),
                        help='directory holding the distributables (default: $DIST_DIR)')
    parser.add_argument('--out-dir', type=Path, default=None,
                        help='where to write the two documents (default: --dist-dir)')
    parser.add_argument('--dry-run', action='store_true', help='report, write nothing')
    parser.add_argument('--strict', action='store_true',
                        help='fail if any filename matches no entry in KINDS')
    args = parser.parse_args()

    if not args.dist_dir.is_dir():
        print(f'error: no such directory: {args.dist_dir}', file=sys.stderr)
        return 1

    full, summary, unknown = build(args.dist_dir, args.strict)
    if not full['releases']:
        print(f'error: no ecod.<release>.* files under {args.dist_dir}; '
              f'refusing to publish an empty index', file=sys.stderr)
        return 1

    current = next(r for r in full['releases'] if r['current'])
    print(f"{full['release_count']} releases, "
          f"{full['span']['first']} to {full['span']['last']}")
    print(f"current: {current['release']} ({current['date']}, "
          f"{current['date_source']}), {current['file_count']} files, "
          f"{current['total_bytes'] / 1e9:.1f} GB")
    print(f"  members: {', '.join(current['has'])}")
    print(f"aliases: {len(full['aliases'])}")
    if unknown:
        names = sorted(name for _, name in unknown)
        print(f'note: {len(names)} file(s) published as "Other": '
              f"{', '.join(names[:4])}{' ...' if len(names) > 4 else ''}")

    out_dir = args.out_dir or args.dist_dir
    if args.dry_run:
        print(f'dry run: would write {FULL_DOC} and {SUMMARY_DOC} to {out_dir}')
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    write_atomic(out_dir / FULL_DOC, full)
    write_atomic(out_dir / SUMMARY_DOC, summary)
    print(f'wrote {out_dir / FULL_DOC} and {out_dir / SUMMARY_DOC}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

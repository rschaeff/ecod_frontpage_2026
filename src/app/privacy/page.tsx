import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What ECOD records about visits, and why.',
};

const h2 = 'text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3';
const p = 'text-gray-700 dark:text-gray-300 mb-3';
const li = 'text-gray-700 dark:text-gray-300';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Privacy</h1>

      <p className={p}>
        ECOD is an academic resource funded by research grants. To report how it is used, we count
        visits, searches, and downloads. We do this without cookies, without tracking you across
        sites or across days, and without sharing anything with third parties.
      </p>

      <h2 className={h2}>What we record</h2>
      <ul className="list-disc pl-6 space-y-1 mb-3">
        <li className={li}>The page or file requested (the address only, never search terms or submitted sequences)</li>
        <li className={li}>The time of the request</li>
        <li className={li}>The website that linked to us (its host name only, e.g. <code>www.uniprot.org</code>)</li>
        <li className={li}>An approximate location (country, city, and the city&apos;s coordinates to about 10 km)</li>
        <li className={li}>Whether the request came from a browser or an automated client</li>
        <li className={li}>
          A daily visitor code, which lets us count distinct visitors per day. It is a one-way hash of
          your IP address and browser identifier with a random key. The key is deleted after the following day,
          after which the code cannot be linked to you or to your visits on other days.
        </li>
      </ul>

      <h2 className={h2}>What we do not record</h2>
      <p className={p}>
        We do not store IP addresses. Your IP address is used briefly to compute the daily code and
        to look up your approximate location in a local database, then discarded. We set no
        tracking cookies and store nothing on your device for statistics. We use no third-party
        analytics services.
      </p>

      <h2 className={h2}>Cookies</h2>
      <p className={p}>
        Only if you accept them, two preference cookies remember your light or dark theme and your
        cookie choice. They are never used for statistics.
      </p>

      <h2 className={h2}>Why, and for how long</h2>
      <p className={p}>
        The legal basis is our legitimate interest in running and funding a public scientific
        resource (GDPR Art. 6(1)(f)). The records are kept to report usage over the lifetime
        of our grants. They are used only in aggregate, for example &ldquo;visitors per month
        from 120 countries&rdquo;.
      </p>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        Questions or requests:{' '}
        <a href="mailto:ecod.database@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">
          ecod.database@gmail.com
        </a>
        . You may also lodge a complaint with your data protection authority.
      </p>
    </div>
  );
}

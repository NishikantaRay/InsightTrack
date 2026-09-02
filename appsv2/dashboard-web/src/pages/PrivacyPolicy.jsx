import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';

/**
 * Public Privacy Policy page (/privacy-policy).
 *
 * TEMPLATE: This is a starting-point policy that reflects how InsightsTrack
 * is designed to work (cookieless, no IP storage, anonymous IDs). Review and
 * adapt it with legal counsel for your jurisdiction before publishing.
 */
export default function PrivacyPolicy() {
    const updated = 'June 2026';
    useSeo({
        title: 'Privacy Policy',
        description: 'How InsightsTrack handles data: cookieless, no IP storage, no fingerprinting, pseudonymous visitor identifiers, DNT/GPC honored. GDPR-friendly by design.',
        path: '/privacy-policy',
    });
    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white">
            <header className="border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px]">InsightsTrack</span>
                    </Link>
                    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to home
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-5 py-12 prose-legal">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Privacy Policy</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: {updated}</p>

                <Section title="Overview">
                    InsightsTrack is a privacy-friendly, self-hosted website analytics tool. It is built
                    so that website operators can understand their traffic <strong>without</strong> collecting
                    personal data from visitors. This policy explains what InsightsTrack collects when you
                    use the software on this instance.
                </Section>

                <Section title="What we collect">
                    For each pageview, InsightsTrack records non-identifying technical data: the page URL and
                    path, referrer, an anonymous first-party visitor identifier, device type, browser, operating
                    system, approximate country (derived from request metadata, not stored IP), and timestamps.
                    It also captures aggregate events such as clicks, scroll depth, Core Web Vitals, and JavaScript
                    errors when enabled by the site operator.
                </Section>

                <Section title="What we do NOT collect">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>No cookies are set.</li>
                        <li>No IP addresses are stored.</li>
                        <li>No browser fingerprinting is performed.</li>
                        <li>No personal data is sold, rented, or shared with third parties.</li>
                        <li>No cross-site tracking or advertising profiles are built.</li>
                    </ul>
                </Section>

                <Section title="Pseudonymous visitor IDs">
                    To distinguish unique visitors and sessions, InsightsTrack generates a random identifier
                    stored in the visitor's browser (first-party localStorage). It is not linked to any name,
                    email, or other directly identifying information, and is not shared across other websites.
                    Because it persists on the device until browser storage is cleared, it is best described as
                    pseudonymous rather than anonymous.
                </Section>

                <Section title="Do Not Track & Global Privacy Control">
                    InsightsTrack respects the browser <strong>Do Not Track (DNT)</strong> and
                    <strong> Global Privacy Control (GPC)</strong> signals. When either is enabled, tracking
                    is suppressed for that visitor.
                </Section>

                <Section title="Data ownership & retention">
                    Because InsightsTrack is self-hosted, all analytics data resides on the infrastructure
                    operated by the website owner running this instance. Retention is configured by that
                    operator. InsightsTrack (the software project) never receives your data.
                </Section>

                <Section title="Your rights">
                    Depending on your jurisdiction (e.g. GDPR, CCPA) you may have rights to access, correct,
                    or delete data about you. Since InsightsTrack stores no personal identifiers, such requests
                    should be directed to the operator of the specific website you visited.
                </Section>

                <Section title="Contact">
                    Questions about the InsightsTrack software can be directed to{' '}
                    <a href="mailto:nishikantaray1@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">nishikantaray1@gmail.com</a>{' '}
                    or via <a href="https://github.com/NishikantaRay/InsightTrack" className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
                </Section>

                <p className="mt-10 text-xs text-gray-400 dark:text-gray-600">
                    This document is a template provided with the open-source project and does not constitute
                    legal advice. Operators should adapt it to their jurisdiction and use case.
                </p>

                <div className="mt-8 flex gap-4 text-sm">
                    <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service →</Link>
                </div>
            </main>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-bold mb-2">{title}</h2>
            <div className="text-sm sm:text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">{children}</div>
        </section>
    );
}

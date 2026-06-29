import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';

/**
 * Public Terms of Service page (/terms).
 *
 * TEMPLATE: Reflects the open-source, self-hosted, "as-is" nature of the
 * project. Review and adapt with legal counsel before publishing.
 */
export default function Terms() {
    const updated = 'June 2026';
    useSeo({
        title: 'Terms of Service',
        description: 'Terms for using InsightsTrack — the open-source (MIT), self-hosted analytics platform and its live demo.',
        path: '/terms',
    });
    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white">
            <header className="border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
                    <Link to="/landing" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px]">InsightsTrack</span>
                    </Link>
                    <Link to="/landing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to home
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-5 py-12">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: {updated}</p>

                <Section title="1. About InsightsTrack">
                    InsightsTrack is open-source software released under the MIT License. It is provided for you
                    to self-host and operate on your own infrastructure. These terms cover use of the software
                    and any demo instance made available by the project.
                </Section>

                <Section title="2. License">
                    The software is licensed under the MIT License. You are free to use, copy, modify, and
                    distribute it in accordance with that license. The full license text ships with the source code.
                </Section>

                <Section title="3. As-is, no warranty">
                    The software and any demo instance are provided <strong>&ldquo;as is&rdquo;</strong>, without warranty
                    of any kind, express or implied. The authors are not liable for any claim, damages, or other
                    liability arising from the use of the software, to the maximum extent permitted by law.
                </Section>

                <Section title="4. Demo instance">
                    Any public demo instance is for evaluation only. Do not store confidential or production data
                    in it. Demo data may be reset or removed at any time without notice.
                </Section>

                <Section title="5. Acceptable use">
                    When using a hosted or demo instance you agree not to abuse it — including attempting to
                    disrupt the service, exceed reasonable usage, or use it for unlawful purposes.
                </Section>

                <Section title="6. Your responsibilities as an operator">
                    If you self-host InsightsTrack, you are responsible for how you collect and process data from
                    your visitors, for compliance with applicable laws (e.g. GDPR, CCPA), and for securing your
                    instance (secrets, HTTPS, access control).
                </Section>

                <Section title="7. Changes">
                    These terms may be updated over time. Material changes will be reflected by the "last updated"
                    date above.
                </Section>

                <Section title="8. Contact">
                    Questions? Reach out at{' '}
                    <a href="mailto:nishikantaray1@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">nishikantaray1@gmail.com</a>{' '}
                    or on <a href="https://github.com/NishikantaRay/InsightTrack" className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
                </Section>

                <p className="mt-10 text-xs text-gray-400 dark:text-gray-600">
                    This document is a template provided with the open-source project and does not constitute
                    legal advice.
                </p>

                <div className="mt-8 flex gap-4 text-sm">
                    <Link to="/privacy-policy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy →</Link>
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

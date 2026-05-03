import UserFlowChart from '../components/charts/UserFlowChart';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import PageNote from '../components/ui/PageNote';

export default function UserFlow() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">User Flow</h1>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                    How visitors navigate through your website
                </p>
            </div>

            <PageNote
                title="What is User Flow?"
                summary="User Flow visualises the paths visitors take through your site — from the first page they land on, to the pages they visit next, and where they drop off."
                details={[
                    { label: 'Entry Points', text: 'The first page of each session. These are your traffic entry doors — most commonly your homepage, blog posts, or landing pages.' },
                    { label: 'Navigation Paths', text: 'Sankey-style diagram showing how many visitors move from page A to page B. Wider lines mean more traffic flowing that way.' },
                    { label: 'Drop-off Points', text: 'Pages where a large number of visitors end their session. These are your leak points — prioritise improving them to keep visitors on-site.' },
                ]}
                businessTip="If many visitors land on your homepage but very few make it to your product or pricing page, your homepage navigation or messaging needs work. User Flow shows you exactly where people go — and where they stop."
                devTip="User flow data is built from ordered session events in DuckDB using window functions to get next-page transitions. Served from GET /api/analytics/:siteId/user-flow. Rendered as a Sankey diagram via recharts-sankey or a custom SVG component."
            />

            <ErrorBoundary fallbackMessage="Failed to load user flow data.">
                <UserFlowChart />
            </ErrorBoundary>
        </div>
    );
}

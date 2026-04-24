import FunnelChart from '../components/charts/FunnelChart';

export default function Funnels() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Funnels</h1>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                    Track conversion through key user journeys
                </p>
            </div>

            <div className="max-w-3xl">
                <FunnelChart />
            </div>
        </div>
    );
}

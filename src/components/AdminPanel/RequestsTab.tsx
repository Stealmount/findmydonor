import { BloodRequest } from '../../types';

interface RequestsTabProps {
  requests: BloodRequest[];
}

export default function RequestsTab({ requests }: RequestsTabProps) {
  return (
    <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Emergency Request Pipeline</h2>

      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#16161c] text-zinc-500 font-medium text-[11px]">
              <th className="py-2.5 font-medium">Tracking Code</th>
              <th className="py-2.5 font-medium">Patient</th>
              <th className="py-2.5 font-medium">Blood & Units</th>
              <th className="py-2.5 font-medium">Urgency</th>
              <th className="py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141418]">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-[#0f0f13] transition">
                <td className="py-3 font-mono text-rose-400 font-medium">{req.tracking_code}</td>
                <td className="py-3 text-white font-medium">{req.patient_name}</td>
                <td className="py-3 text-zinc-300">{req.blood_type_needed} ({req.units_required} Units)</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                    req.urgency_level === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {req.urgency_level}
                  </span>
                </td>
                <td className="py-3 text-zinc-400">{req.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

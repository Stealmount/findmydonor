import { motion } from 'framer-motion';
import { BloodType } from '../../types';
import { lookupPincode } from '../../types';

interface ProfileStepProps {
  bloodGroup: BloodType | '';
  weightKg: string;
  donorPincode: string;
  donorArea: string;
  donorCity: string;
  lastDonationDate: string;
  neverDonated: boolean;
  emergencyOnly: boolean;
  healthDeclaration: boolean;
  loading: boolean;
  isHi: boolean;
  card: string;
  field: string;
  btnPrimary: string;
  setBloodGroup: (v: BloodType | '') => void;
  setWeightKg: (v: string) => void;
  setDonorPincode: (v: string) => void;
  setDonorArea: (v: string) => void;
  setDonorCity: (v: string) => void;
  setLastDonationDate: (v: string) => void;
  setNeverDonated: (v: boolean) => void;
  setEmergencyOnly: (v: boolean) => void;
  setHealthDeclaration: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProfileStep(props: ProfileStepProps) {
  const {
    bloodGroup, weightKg, donorPincode, donorArea, donorCity, lastDonationDate, neverDonated,
    emergencyOnly, healthDeclaration, loading, isHi, card, field, btnPrimary,
    setBloodGroup, setWeightKg, setDonorPincode, setDonorArea, setDonorCity,
    setLastDonationDate, setNeverDonated, setEmergencyOnly, setHealthDeclaration, onSubmit,
  } = props;

  return (
    <motion.form key="donor-profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={onSubmit}>
      <h2 className="text-xl font-bold text-ink-900">{isHi ? 'आपकी डोनर प्रोफ़ाइल' : 'Your donor profile'}</h2>
      <p className="mb-4 text-sm text-ink-500">{isHi ? 'जरूरतमंदों से मिलान के लिए।' : 'Helps us match you with compatible requests nearby.'}</p>

      <label className="block text-xs font-bold text-ink-600">
        {isHi ? 'ब्लड ग्रुप *' : 'Blood group *'}
        <select required className={`${field} mt-1`} value={bloodGroup} onChange={e => setBloodGroup(e.target.value as BloodType)}>
          <option value="">{isHi ? 'ब्लड ग्रुप चुनें' : 'Select blood group'}</option>
          {(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as BloodType[]).map(bg => (
            <option key={bg} value={bg}>{bg}</option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-xs font-bold text-ink-600">
        {isHi ? 'वजन (किग्रा) * (कम से कम 45 किग्रा)' : 'Weight (kg) * (Min 45 kg required)'}
        <input
          required
          type="number"
          min={45}
          max={250}
          placeholder="e.g. 60"
          className={`${field} mt-1`}
          value={weightKg}
          onChange={e => setWeightKg(e.target.value)}
        />
      </label>

      <label className="mt-4 block text-xs font-bold text-ink-600">
        {isHi ? 'पिनकोड *' : 'Pincode *'}
        <input
          required
          className={`${field} mt-1`}
          inputMode="numeric"
          maxLength={6}
          placeholder="e.g. 110001"
          value={donorPincode}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setDonorPincode(val);
            if (val.length === 6) {
              const result = lookupPincode(val);
              if (result) { setDonorArea(result.area); setDonorCity(result.city); }
            }
          }}
        />
      </label>
      {donorArea && (
        <p className="text-xs font-semibold text-emerald-700">📍 {donorArea}, {donorCity}</p>
      )}

      <label className="mt-4 block text-xs font-bold text-ink-600">
        {isHi ? 'अंतिम दान तारीख' : 'Last donation date'}
        <input
          type="date"
          disabled={neverDonated}
          max={new Date().toISOString().split('T')[0]}
          className={`${field} mt-1`}
          value={lastDonationDate}
          onChange={e => setLastDonationDate(e.target.value)}
        />
      </label>
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
        <input type="checkbox" checked={neverDonated} onChange={e => { setNeverDonated(e.target.checked); if (e.target.checked) setLastDonationDate(''); }} />
        {isHi ? 'मैंने पहले कभी रक्तदान नहीं किया' : 'I have never donated blood before'}
      </label>

      <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
        <input type="checkbox" checked={emergencyOnly} onChange={e => setEmergencyOnly(e.target.checked)} />
        {isHi ? 'केवल आपातकालीन मामलों के लिए संपर्क करें' : 'Only contact me for critical/emergency cases'}
      </label>

      <label className="mt-3 flex gap-3 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
        <input required type="checkbox" checked={healthDeclaration} onChange={e => setHealthDeclaration(e.target.checked)} />
        {isHi
          ? 'मैं पुष्टि करता/करती हूँ कि मैं 18-65 वर्ष का/की हूँ, मेरा वज़न कम से कम 45 किग्रा है, और मैंने पिछले 90 दिनों में दान नहीं किया है।'
          : 'I confirm I am 18–65 years old, weigh at least 45 kg, am not on blood-donation-restricting medication, and have not donated in the last 90 days.'}
      </label>

      <button disabled={loading} className={btnPrimary}>
        {loading ? (isHi ? 'सहेजा जा रहा है…' : 'Saving…') : (isHi ? 'पंजीकरण पूरा करें →' : 'Complete registration →')}
      </button>
    </motion.form>
  );
}

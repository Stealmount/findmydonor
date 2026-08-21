import React from 'react';
import { useState } from 'react';
import { User, Match, DonationLog } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import {
 Heart,
 MapPin,
 Clock,
 Phone,
 User as UserIcon,
 LogOut,
 Shield,
 ArrowRight,
 AlertTriangle,
 Trash2,
} from 'lucide-react';
import DeleteAccountModal from '../ui/DeleteAccountModal';

interface ProfileCardProps {
 user: User;
 matches: Match[];
 donationLogs: DonationLog[];
 onLogout: () => void;
 onCompleteProfile: () => void;
 onNavigateToRequest?: () => void;
}

/** Glass overview header, warning banners, medical summary, and donor stat strip. */
export default function ProfileCard({ user, matches, donationLogs, onLogout, onCompleteProfile, onNavigateToRequest }: ProfileCardProps) {
 const { t, language } = useLanguage();
 const isHi = language === 'HI';
 const isCooldown = user.account_status === 'cooldown';
 const [showDeleteModal, setShowDeleteModal] = useState(false);

 return (
 <>
 {/* Sleek Glass Overview Header */}
 <div className="rounded-[36px] bg-gradient-to-b from-blood-600 to-blood-700 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" aria-hidden="true" />
 <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" aria-hidden="true" />

 <div className="flex items-center gap-5 relative z-10">
 <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-white/15 backdrop-blur ring-1 ring-white/20 text-white">
 <UserIcon className="w-8 h-8" />
 </div>
 <div>
 <div className="flex flex-wrap items-center gap-2.5">
 <h2 className="text-2xl font-semibold tracking-tight text-white">{user.full_name}</h2>
 {user.aadhaar_verified && (
 <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white ring-1 ring-white/20">
 <Shield className="w-3 h-3 text-emerald-300 fill-emerald-300/20" />
 <span>DigiLocker</span>
 </div>
 )}
 <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${
 isCooldown ? 'bg-white/10 text-white ring-1 ring-white/20' :
 user.account_status === 'active' ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30' : 'bg-white/5 text-white/70 ring-1 ring-white/10'
 }`}>
 {isHi ? (user.account_status === 'active' ? 'सक्रिय' : user.account_status === 'cooldown' ? 'विश्राम अवधि' : 'निष्क्रिय') : user.account_status}
 </span>
 </div>
 <p className="text-xs text-white/70 mt-1.5">{t.donorDashboard.memberSince} {new Date(user.created_at).toLocaleDateString()}</p>
 </div>
 </div>

 {/* Cooldown End Timer Display */}
 {isCooldown && user.cooldown_until && (
 <div id="cooldown-timer-badge" className="p-4 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center gap-3 md:max-w-xs relative z-10 backdrop-blur-md">
 <Clock className="w-5 h-5 text-white/90 flex-shrink-0" />
 <div className="text-xs text-white/90 leading-tight">
 <span className="font-semibold text-white block mb-0.5">{t.donorDashboard.cooldownActive}</span>
 {t.donorDashboard.backInPool} <strong className="font-bold">{user.cooldown_until}</strong>
 </div>
 </div>
 )}

 <div className="flex items-center gap-3 relative z-10">
 <div className="rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20 px-4 py-2 text-center text-white min-w-[90px]">
 <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-white/60">{t.donorDashboard.bloodType}</span>
 <span className="text-xl font-bold">{user.blood_type || '—'}</span>
 </div>
 <button
 id="btn-donor-delete-account"
 onClick={() => setShowDeleteModal(true)}
 className="p-3 rounded-2xl bg-white/10 text-red-200 hover:bg-red-500/20 transition-colors cursor-pointer ring-1 ring-white/20"
 title={isHi ? 'खाता हटाएं' : 'Delete Account'}
>
 <Trash2 className="w-5 h-5" />
 </button>
 <button
 id="btn-donor-logout"
 onClick={onLogout}
 className="p-3 rounded-2xl bg-white text-blood-700 hover:bg-white/90 transition-colors cursor-pointer"
 title={isHi ? 'लॉग आउट' : 'Log Out'}
>
 <LogOut className="w-5 h-5" />
 </button>
 </div>
 </div>

 <DeleteAccountModal
 open={showDeleteModal}
 onClose={() => setShowDeleteModal(false)}
 onDeleted={onLogout}
 />

 {/* ⚠️ Incomplete Profile Warning Alert Banner */}
 {(!user.profile_complete || !user.blood_type || !user.pincode) && (
 <div className="rounded-3xl bg-amber-500/10 border border-amber-500/30 p-6 sm:p-7 text-ink-900 relative overflow-hidden ">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
 <div className="flex items-start sm:items-center gap-4">
 <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-600 font-bold text-xl shrink-0 shadow-inner">
 <AlertTriangle className="w-6 h-6 text-amber-600" />
 </div>
 <div>
 <h3 className="text-base font-extrabold text-ink-900 tracking-tight flex items-center gap-2">
 <span>{isHi ? 'डोनर प्रोफ़ाइल अधूरी है — तत्काल जानकारी जोड़ें' : 'Incomplete Donor Profile — Action Required'}</span>
 <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-bold uppercase">Action Required</span>
 </h3>
 <p className="text-xs text-ink-600 mt-1 leading-relaxed">
 {isHi
 ? 'आपातकालीन ब्लड मैच अलर्ट प्राप्त करने के लिए अपना ब्लड ग्रुप, वजन (किग्रा), पिनकोड और लोकेशन की जानकारी पूरी करें।'
 : 'Please complete your Blood Group, Weight (kg), and Location details so our matching engine can ping you during emergency blood requests.'}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={onCompleteProfile}
 className=" px-6 py-3 rounded-full bg-blood-600 hover:bg-blood-700 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
>
 {isHi ? 'प्रोफ़ाइल पूरी करें →' : 'Complete Profile Now →'}
 </button>
 </div>
 </div>
 )}

 {/* ⚡ Need Blood? Switch to Requester Mode / Request Generator Banner */}
 {onNavigateToRequest && (
 <div className="rounded-3xl bg-gradient-to-r from-ink-900 via-ink-950 to-blood-950 border border-blood-500/30 p-6 sm:p-7 text-white relative overflow-hidden -lg">
 <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-blood-600/15 blur-3xl pointer-events-none" />
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
 <div className="flex items-start sm:items-center gap-4 max-w-2xl">
 <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blood-500/20 border border-blood-500/30 text-blood-400 font-bold text-xl shrink-0 shadow-inner">
 ⚡
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-extrabold text-white tracking-tight">
 {isHi ? 'क्या परिवार या मरीज के लिए तुरंत रक्त चाहिए?' : 'Need Emergency Blood for Family or Patient?'}
 </span>
 <span className="px-2 py-0.5 rounded-full bg-blood-500/20 border border-blood-500/30 text-blood-400 text-[10px] font-mono font-bold uppercase">
 1-Click Switch
 </span>
 </div>
 <p className="text-xs text-ink-300 mt-1 leading-relaxed">
 {isHi
 ? 'आप एक सत्यापित रक्तदाता हैं! बिना दोबारा पंजीकरण किए तुरंत अनुरोधकर्ता मोड में जाएं और रक्त अनुरोध जनरेट करें।'
 : 'You are a verified donor! Instantly switch to Requester Mode and broadcast an emergency blood request without signing up again.'}
 </p>
 </div>
 </div>
 <button
 id="btn-donor-switch-requester"
 type="button"
 onClick={onNavigateToRequest}
 className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blood-600 hover:bg-blood-700 text-white font-extrabold text-xs transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
>
 <span>{isHi ? '➕ रक्त अनुरोध जनरेट करें →' : '➕ Switch & Request Blood →'}</span>
 </button>
 </div>
 </div>
 )}

 {/* Donor Profile & Medical Details Summary Card */}
 <div className="rounded-3xl bg-white/95 border border-ink-200/80 p-6 sm:p-7 relative overflow-hidden">
 <div className="flex items-center justify-between border-b border-ink-100 pb-4 mb-5">
 <div className="flex items-center gap-3">
 <div className="grid h-10 w-10 place-items-center rounded-2xl blood-drop-gradient text-white">
 <UserIcon className="w-5 h-5" />
 </div>
 <div>
 <h3 className="text-base font-extrabold text-ink-900 tracking-tight">
 {isHi ? 'मेरी डोनर प्रोफ़ाइल और मेडिकल विवरण' : 'My Donor Medical Profile & Details'}
 </h3>
 <p className="text-xs text-ink-500">
 {isHi ? 'आपातकालीन मिलान और संपर्क के लिए आपके सहेजे गए विवरण' : 'Your registered blood group, location, weight, and emergency preferences'}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={onCompleteProfile}
 className="px-4 py-2 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-900 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-ink-200"
>
 <span>{isHi ? 'संपादित करें / अपडेट' : 'Edit Details'}</span>
 </button>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
 {/* Blood Group */}
 <div className="p-3.5 rounded-2xl bg-ink-50/80 border border-ink-100 space-y-1">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
 {isHi ? 'ब्लड ग्रुप' : 'Blood Group'}
 </span>
 <div className="flex items-center gap-1.5">
 <span className="text-lg font-black text-blood-600">
 {user.blood_type || (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>
 </div>

 {/* Weight */}
 <div className="p-3.5 rounded-2xl bg-ink-50/80 border border-ink-100 space-y-1">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
 {isHi ? 'वजन (किग्रा)' : 'Weight (kg)'}
 </span>
 <span className="text-base font-extrabold text-ink-900">
 {user.weight_kg ? `${user.weight_kg} kg` : (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>

 {/* Location & Pincode */}
 <div className="p-3.5 rounded-2xl bg-ink-50/80 border border-ink-100 space-y-1">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
 {isHi ? 'स्थान / पिनकोड' : 'Pincode & Location'}
 </span>
 <div className="flex items-center gap-1 text-ink-900 font-bold truncate">
 <MapPin className="w-3.5 h-3.5 text-blood-600 shrink-0" />
 <span className="truncate">
 {user.pincode ? `${user.area || ''} (${user.pincode})` : (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>
 </div>

 {/* WhatsApp / Phone */}
 <div className="p-3.5 rounded-2xl bg-ink-50/80 border border-ink-100 space-y-1">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
 {isHi ? 'WhatsApp नंबर' : 'WhatsApp Contact'}
 </span>
 <div className="flex items-center gap-1 text-ink-900 font-bold truncate">
 <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
 <span className="truncate">
 {user.whatsapp_number || user.phone || '—'}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Donor Stat Strip */}
 <div id="donor-stat-strip" className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="rounded-3xl bg-white/95 border border-ink-200/80 p-5 hover:shadow-md transition-shadow">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
 {isHi ? 'लंबित मिलान' : 'Pending Matches'}
 </span>
 <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
 <Clock className="w-5 h-5" />
 </div>
 </div>
 <p className="text-3xl font-extrabold text-ink-900 mt-2">
 {matches.filter(m => m.donor_response === 'pending').length}
 </p>
 <p className="text-[11px] text-ink-400 mt-1">
 {isHi ? 'कार्रवाई की प्रतीक्षा में' : 'Awaiting your response'}
 </p>
 </div>

 <div className="rounded-3xl bg-white/95 border border-ink-200/80 p-5 hover:shadow-md transition-shadow">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
 {isHi ? 'कुल रक्तदान' : 'Total Donations'}
 </span>
 <div className="grid h-9 w-9 place-items-center rounded-xl bg-blood-500/10 text-blood-600">
 <Heart className="w-5 h-5 fill-blood-500/20" />
 </div>
 </div>
 <p className="text-3xl font-extrabold text-ink-900 mt-2">
 {donationLogs.length}
 </p>
 <p className="text-[11px] text-ink-400 mt-1">
 {isHi ? 'सफलतापूर्वक पूर्ण' : 'Completed lifetime'}
 </p>
 </div>

 <div className="rounded-3xl bg-white/95 border border-ink-200/80 p-5 hover:shadow-md transition-shadow">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
 {isHi ? 'बचाए गए जीवन' : 'Lives Saved'}
 </span>
 <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
 <Shield className="w-5 h-5" />
 </div>
 </div>
 <p className="text-3xl font-extrabold text-emerald-600 mt-2">
 {donationLogs.length * 3}
 </p>
 <p className="text-[11px] text-ink-400 mt-1">
 {isHi ? 'अनुमानित प्रभाव (3 जीवन/रक्तदान)' : 'Estimated impact (3 lives/donation)'}
 </p>
 </div>
 </div>
 </>
 );
}

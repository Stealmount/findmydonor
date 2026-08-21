import React from 'react';
import { ArrowLeft, Droplet, CheckCircle, ShieldAlert, Award, Heart } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';

interface BloodCompatibilityPageProps {
 onNavigate: (view: any) => void;
}

const ALL_BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export function BloodCompatibilityPage({ onNavigate }: BloodCompatibilityPageProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';

 return (
 <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
 <div className="max-w-4xl mx-auto space-y-8">
 
 {/* Header Navigation */}
 <div className="flex items-center justify-between border-b border-slate-800 pb-6">
 <button
 onClick={() => onNavigate('home')}
 className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
>
 <ArrowLeft className="w-4 h-4" />
 <span>{isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home'}</span>
 </button>
 <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
 <Droplet className="w-5 h-5 fill-rose-500" />
 <span>FindMyDonor™ Clinical Reference</span>
 </div>
 </div>

 {/* Title Section */}
 <div className="space-y-2">
 <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
 {isHi ? 'रक्त समूह अनुकूलता निर्देशिका (Blood Compatibility Guide)' : 'Blood Type Compatibility Guide'}
 </h1>
 <p className="text-slate-400 text-sm leading-relaxed">
 {isHi 
 ? 'जानिए कौन सा रक्त समूह किसे दान कर सकता है। FindMyDonor का स्वचालित मैचिंग इंजन इन्हीं सिद्धांतों पर काम करता है।'
 : 'Understand which blood types can donate to and receive from each other. Learn how FindMyDonor matches donors with urgent requests.'}
 </p>
 </div>

 {/* Highlight Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="bg-rose-950/40 border border-rose-600/40 rounded-2xl p-5 space-y-2">
 <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
 <Heart className="w-5 h-5 fill-rose-400" />
 <h3>{isHi ? 'O- (यूनिवर्सल डोनर)' : 'O- (Universal Donor)'}</h3>
 </div>
 <p className="text-xs text-slate-300 leading-relaxed">
 {isHi 
 ? 'O-निगेटिव रक्त किसी भी रक्त समूह वाले मरीज को दिया जा सकता है। आपातकालीन स्थिति में O- डोनर्स की सबसे अधिक मांग होती है।'
 : 'O-Negative red blood cells can be transfused to patients of ANY blood group. It is vital in emergency traumas when patient blood type is unknown.'}
 </p>
 </div>

 <div className="bg-blue-950/40 border border-blue-600/40 rounded-2xl p-5 space-y-2">
 <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
 <Award className="w-5 h-5" />
 <h3>{isHi ? 'AB+ (यूनिवर्सल प्राप्तकर्ता)' : 'AB+ (Universal Recipient)'}</h3>
 </div>
 <p className="text-xs text-slate-300 leading-relaxed">
 {isHi 
 ? 'AB-पॉजिटिव मरीज किसी भी रक्त समूह (A, B, AB, O) से रक्त प्राप्त कर सकते हैं।'
 : 'AB-Positive patients can safely receive red blood cells from all 8 blood groups (A, B, AB, O both positive and negative).'}
 </p>
 </div>
 </div>

 {/* Master Compatibility Table */}
 <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-6">
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 <CheckCircle className="w-5 h-5 text-emerald-400" />
 <span>{isHi ? 'संपूर्ण रक्त अनुकूलता तालिका' : 'Full Blood Compatibility Matrix'}</span>
 </h2>

 <div className="space-y-4">
 {ALL_BLOOD_TYPES.map((type) => {
 const canReceiveFrom = BLOOD_COMPATIBILITY_MATRIX[type];
 const canGiveTo = ALL_BLOOD_TYPES.filter(recipient => 
 BLOOD_COMPATIBILITY_MATRIX[recipient].includes(type)
 );

 return (
 <div key={type} className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center font-black text-rose-400 text-base">
 {type}
 </div>
 <div>
 <span className="font-bold text-white text-sm">{isHi ? `रक्त समूह ${type}` : `Blood Group ${type}`}</span>
 <span className="text-xs text-slate-400 block mt-0.5">
 {type === 'O-' ? 'Universal Donor' : type === 'AB+' ? 'Universal Recipient' : 'Specific Match Rules'}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:w-2/3">
 <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700/50">
 <span className="font-bold text-emerald-400 block mb-0.5">{isHi ? 'दान कर सकते हैं:' : 'Can Give To:'}</span>
 <span className="text-slate-200 font-semibold">{canGiveTo.join(', ')}</span>
 </div>
 <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700/50">
 <span className="font-bold text-blue-400 block mb-0.5">{isHi ? 'प्राप्त कर सकते हैं:' : 'Can Receive From:'}</span>
 <span className="text-slate-200 font-semibold">{canReceiveFrom.join(', ')}</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Action CTAs */}
 <div className="pt-4 flex flex-col sm:flex-row gap-4">
 <button
 onClick={() => onNavigate('auth-signup')}
 className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-sm transition-all text-center cursor-pointer"
>
 {isHi ? 'रक्तदाता के रूप में पंजीकरण करें →' : 'Register as Volunteer Donor →'}
 </button>
 <button
 onClick={() => onNavigate('request')}
 className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-extrabold text-sm transition-all text-center cursor-pointer"
>
 {isHi ? 'रक्त आवश्यकता पोस्ट करें' : 'Post Emergency Request'}
 </button>
 </div>

 </div>
 </div>
 );
}

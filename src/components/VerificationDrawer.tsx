import React, { useState } from 'react';
import { Mail, Phone, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Sparkles, Send } from 'lucide-react';
import { UserAccount } from '../lib/types';
import { Button } from './Button';

export interface VerificationDrawerProps {
  user: UserAccount;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (type: 'email' | 'phone', code: string) => Promise<void>;
  onResend: (type: 'email' | 'phone') => Promise<void>;
}

export const VerificationDrawer: React.FC<VerificationDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onVerify,
  onResend,
}) => {
  const [emailInputCode, setEmailInputCode] = useState('');
  const [phoneInputCode, setPhoneInputCode] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isResendingPhone, setIsResendingPhone] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'good' | 'err'; text: string } | null>(null);
  const [phoneStatusMsg, setPhoneStatusMsg] = useState<{ type: 'good' | 'err'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleVerifyEmail = async () => {
    if (!emailInputCode.trim()) return;
    setIsVerifyingEmail(true);
    setEmailStatusMsg(null);
    try {
      await onVerify('email', emailInputCode.trim());
      setEmailStatusMsg({ type: 'good', text: 'Email verified successfully!' });
      setEmailInputCode('');
    } catch (err: any) {
      setEmailStatusMsg({ type: 'err', text: err.message || 'Invalid code' });
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!phoneInputCode.trim()) return;
    setIsVerifyingPhone(true);
    setPhoneStatusMsg(null);
    try {
      await onVerify('phone', phoneInputCode.trim());
      setPhoneStatusMsg({ type: 'good', text: 'Phone verified successfully!' });
      setPhoneInputCode('');
    } catch (err: any) {
      setPhoneStatusMsg({ type: 'err', text: err.message || 'Invalid code' });
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleResend = async (type: 'email' | 'phone') => {
    if (type === 'email') {
      setIsResendingEmail(true);
      try {
        await onResend('email');
        setEmailStatusMsg({ type: 'good', text: 'New verification email dispatched in background!' });
      } catch (err: any) {
        setEmailStatusMsg({ type: 'err', text: err.message || 'Failed to resend' });
      } finally {
        setIsResendingEmail(false);
      }
    } else {
      setIsResendingPhone(true);
      try {
        await onResend('phone');
        setPhoneStatusMsg({ type: 'good', text: 'New SMS OTP dispatched in background!' });
      } catch (err: any) {
        setPhoneStatusMsg({ type: 'err', text: err.message || 'Failed to resend' });
      } finally {
        setIsResendingPhone(false);
      }
    }
  };

  const isAllVerified = user.emailVerified && user.phoneVerified;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent-weak)] text-[var(--color-accent)] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Security & Contact Verification
              </h3>
              <p className="text-[11px] text-[var(--color-muted)]">
                Verifications are delivered in background — confirm whenever convenient
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close verification drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {isAllVerified ? (
            <div className="p-4 rounded-[var(--radius)] bg-[var(--color-good-weak)] border border-[var(--color-good-border)] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[var(--color-good)] mx-auto" />
              <h4 className="text-sm font-bold text-[var(--color-good-ink)]">
                All Details Verified!
              </h4>
              <p className="text-xs text-[var(--color-good-ink)]/80">
                Your email ({user.email}) and phone ({user.phoneNumber}) are verified. Your account has full verified trust tier.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-[var(--radius)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-border)] text-xs text-[var(--color-text)] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[var(--color-accent)]">
                  Smooth Background Verification
                </p>
                <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                  You are already signed in and can do bug hunts without interruption. When you receive your email link or SMS OTP, enter the 6-digit codes below to mark them verified.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Email Verification */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--color-muted)]" />
                <span className="text-xs font-semibold text-[var(--color-text)]">
                  Email Address
                </span>
              </div>
              {user.emailVerified ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-good)] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Pending in Background
                </span>
              )}
            </div>

            <div className="text-xs font-mono text-[var(--color-text)] bg-[var(--color-surface-subtle)] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              {user.email}
            </div>

            {!user.emailVerified && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit email code"
                    value={emailInputCode}
                    onChange={e => setEmailInputCode(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={emailInputCode.length < 6 || isVerifyingEmail}
                    isLoading={isVerifyingEmail}
                    onClick={handleVerifyEmail}
                  >
                    Verify
                  </Button>
                </div>

                {/* Demo helper */}
                {user.demoVerificationCodes?.emailCode && (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[var(--color-muted)] font-mono">
                      Simulated dispatched code: <strong className="text-[var(--color-accent)]">{user.demoVerificationCodes.emailCode}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEmailInputCode(user.demoVerificationCodes!.emailCode)}
                      className="text-[var(--color-accent)] hover:underline cursor-pointer font-medium"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                {emailStatusMsg && (
                  <p
                    className={`text-[11px] flex items-center gap-1 ${
                      emailStatusMsg.type === 'good' ? 'text-[var(--color-good)]' : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {emailStatusMsg.type === 'good' ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>{emailStatusMsg.text}</span>
                  </p>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isResendingEmail}
                    onClick={() => handleResend('email')}
                    className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isResendingEmail ? 'animate-spin' : ''}`} />
                    <span>Resend email code</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Phone Number Verification */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--color-muted)]" />
                <span className="text-xs font-semibold text-[var(--color-text)]">
                  Phone Number
                </span>
              </div>
              {user.phoneVerified ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-good)] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Pending in Background
                </span>
              )}
            </div>

            <div className="text-xs font-mono text-[var(--color-text)] bg-[var(--color-surface-subtle)] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              {user.phoneNumber}
            </div>

            {!user.phoneVerified && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit SMS code"
                    value={phoneInputCode}
                    onChange={e => setPhoneInputCode(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={phoneInputCode.length < 6 || isVerifyingPhone}
                    isLoading={isVerifyingPhone}
                    onClick={handleVerifyPhone}
                  >
                    Verify
                  </Button>
                </div>

                {/* Demo helper */}
                {user.demoVerificationCodes?.phoneCode && (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[var(--color-muted)] font-mono">
                      Simulated SMS OTP: <strong className="text-[var(--color-accent)]">{user.demoVerificationCodes.phoneCode}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhoneInputCode(user.demoVerificationCodes!.phoneCode)}
                      className="text-[var(--color-accent)] hover:underline cursor-pointer font-medium"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                {phoneStatusMsg && (
                  <p
                    className={`text-[11px] flex items-center gap-1 ${
                      phoneStatusMsg.type === 'good' ? 'text-[var(--color-good)]' : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {phoneStatusMsg.type === 'good' ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>{phoneStatusMsg.text}</span>
                  </p>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isResendingPhone}
                    onClick={() => handleResend('phone')}
                    className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isResendingPhone ? 'animate-spin' : ''}`} />
                    <span>Resend SMS OTP</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[var(--color-muted)] font-mono">
            {isAllVerified ? 'All verified' : 'Background dispatch active'}
          </span>
          <Button size="sm" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

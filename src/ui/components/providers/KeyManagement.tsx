/**
 * Key Management Component - Secure API key management UI
 */

import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';

interface KeyManagementProps {
  providerId: string;
  providerName: string;
  maskedKey: string;
  onKeyUpdated?: () => void;
}

export function KeyManagement({
  providerId,
  providerName,
  maskedKey,
  onKeyUpdated,
}: KeyManagementProps) {
  const api = useApi();
  const [isRotating, setIsRotating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRotateKey = async () => {
    if (!newKey.trim()) {
      setError('Please enter a new API key');
      return;
    }

    setIsRotating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.post(`/api/ai/providers/${providerId}/rotate`, {
        apiKey: newKey,
      });

      if (result.success) {
        setSuccess('API key rotated successfully');
        setNewKey('');
        setShowInput(false);
        onKeyUpdated?.();
      } else {
        setError(result.error || 'Failed to rotate key');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to rotate key');
    } finally {
      setIsRotating(false);
    }
  };

  const handleCancel = () => {
    setShowInput(false);
    setNewKey('');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="key-management" style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>API Key</h4>
        <span style={styles.providerBadge}>{providerName}</span>
      </div>

      <div style={styles.keyDisplay}>
        <span style={styles.maskedKey}>{maskedKey}</span>
        <div style={styles.securityBadge}>
          <span style={styles.lockIcon}>🔐</span>
          <span>AES-256 Encrypted</span>
        </div>
      </div>

      {success && (
        <div style={styles.successMessage}>
          ✅ {success}
        </div>
      )}

      {error && (
        <div style={styles.errorMessage}>
          ❌ {error}
        </div>
      )}

      {!showInput ? (
        <div style={styles.actions}>
          <button
            onClick={() => setShowInput(true)}
            style={styles.rotateButton}
          >
            🔄 Rotate Key
          </button>
          <button
            onClick={async () => {
              const result = await api.post(`/api/ai/providers/${providerId}/test`);
              if (result.data?.valid) {
                setSuccess('Connection verified successfully');
              } else {
                setError(result.data?.error || 'Connection test failed');
              }
            }}
            style={styles.testButton}
          >
            ✓ Test Connection
          </button>
        </div>
      ) : (
        <div style={styles.rotateForm}>
          <label style={styles.label}>New API Key</label>
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Enter new API key"
            style={styles.input}
            autoComplete="off"
          />
          <div style={styles.formActions}>
            <button
              onClick={handleRotateKey}
              disabled={isRotating || !newKey.trim()}
              style={{
                ...styles.confirmButton,
                opacity: isRotating || !newKey.trim() ? 0.5 : 1,
              }}
            >
              {isRotating ? 'Rotating...' : 'Confirm Rotation'}
            </button>
            <button
              onClick={handleCancel}
              style={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
          <p style={styles.warningText}>
            ⚠️ Rotating the key will immediately invalidate the old key.
            Make sure the new key is valid before confirming.
          </p>
        </div>
      )}

      <div style={styles.securityInfo}>
        <h5 style={styles.securityTitle}>Security Features</h5>
        <ul style={styles.securityList}>
          <li>✓ AES-256-GCM encryption at rest</li>
          <li>✓ PBKDF2 key derivation (100k iterations)</li>
          <li>✓ Unique salt per encryption</li>
          <li>✓ Keys never transmitted in plaintext</li>
        </ul>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #2d2d44',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  providerBadge: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  keyDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0d0d1a',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  maskedKey: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#888',
  },
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#22c55e',
    fontSize: '12px',
  },
  lockIcon: {
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  rotateButton: {
    backgroundColor: '#f59e0b',
    color: '#000',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  testButton: {
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  rotateForm: {
    marginTop: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#888',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0d0d1a',
    border: '1px solid #2d2d44',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    fontFamily: 'monospace',
    marginBottom: '12px',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #2d2d44',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: '12px',
    marginTop: '12px',
  },
  successMessage: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid #22c55e',
    color: '#22c55e',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  securityInfo: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #2d2d44',
  },
  securityTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#888',
  },
  securityList: {
    margin: 0,
    padding: '0 0 0 20px',
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.8',
  },
};

export default KeyManagement;

import { useState, useEffect } from 'react';
import StateSelector from './StateSelector';
import CitySelector from './CitySelector';

interface GSTNumberInputProps {
  value: {
    stateId?: string;
    stateName: string;
    stateCode: string;
    gstNumber: string;
    billingAddress?: string;
    billingCityId?: string;
    billingPincode?: string;
    isPrimary: boolean;
  };
  onChange: (value: GSTNumberInputProps['value']) => void;
  onRemove?: () => void;
  error?: {
    stateId?: string;
    gstNumber?: string;
    billingAddress?: string;
    billingCityId?: string;
    billingPincode?: string;
  };
  showRemove?: boolean;
  disabled?: boolean;
  autoValidate?: boolean;
}

export default function GSTNumberInput({
  value,
  onChange,
  onRemove,
  error,
  showRemove = false,
  disabled = false,
  autoValidate = true,
}: GSTNumberInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [states, setStates] = useState<Array<{ id: string; stateName: string; stateCode: string }>>([]);

  useEffect(() => {
    fetchStates();
  }, []);

  useEffect(() => {
    if (autoValidate && value.gstNumber && value.stateCode) {
      validateGSTNumber();
    }
  }, [value.gstNumber, value.stateCode]);

  const fetchStates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/locations/states', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setStates(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching states:', err);
    }
  };

  const validateGSTNumber = async () => {
    if (!value.gstNumber || !value.stateCode) {
      setValidationError(null);
      return;
    }

    try {
      setIsValidating(true);
      setValidationError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/gst/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gstNumber: value.gstNumber.toUpperCase(),
          stateCode: value.stateCode,
        }),
      });

      const result = await response.json();
      const data = result.data;

      if (!response.ok || !data.isValid) {
        setValidationError(data.message || 'Invalid GST number');
      }
    } catch (err) {
      console.error('Error validating GST:', err);
      setValidationError('Failed to validate GST number');
    } finally {
      setIsValidating(false);
    }
  };

  const handleStateChange = (stateId: string | null) => {
    if (!stateId) {
      onChange({ ...value, stateId: undefined, stateName: '', stateCode: '' });
      return;
    }

    const selectedState = states.find((s) => s.id === stateId);
    if (selectedState) {
      onChange({
        ...value,
        stateId: selectedState.id,
        stateName: selectedState.stateName,
        stateCode: selectedState.stateCode,
      });
    }
  };

  const handleGSTNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gstNumber = e.target.value.toUpperCase();
    onChange({ ...value, gstNumber });
  };

  const handleBillingAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, billingAddress: e.target.value });
  };

  const handleIsPrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, isPrimary: e.target.checked });
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.isPrimary}
            onChange={handleIsPrimaryChange}
            disabled={disabled}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="text-sm font-medium text-gray-700">
            Primary GST Registration
          </label>
        </div>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StateSelector
          value={value.stateId}
          onChange={handleStateChange}
          error={error?.stateId}
          label="State"
          required
          disabled={disabled}
          showStateCode
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GST Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.gstNumber}
            onChange={handleGSTNumberChange}
            disabled={disabled}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm uppercase
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${error?.gstNumber || validationError ? 'border-red-500' : 'border-gray-300'}
            `}
          />
          {isValidating && (
            <p className="mt-1 text-sm text-blue-600">Validating...</p>
          )}
          {validationError && !isValidating && (
            <p className="mt-1 text-sm text-red-600">{validationError}</p>
          )}
          {error?.gstNumber && !validationError && (
            <p className="mt-1 text-sm text-red-600">{error.gstNumber}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Format: 2-digit state code + 10-digit PAN + 3-character suffix
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Billing Address for this GST (Optional)
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <CitySelector
              value={value.billingCityId || ''}
              onChange={(cityId) => onChange({ ...value, billingCityId: cityId || undefined })}
              stateId={value.stateId}
              disabled={disabled || !value.stateId}
              placeholder="Select city"
              label="City"
            />
            {error?.billingCityId && (
              <p className="mt-1 text-sm text-red-600">{error.billingCityId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
            <input
              type="text"
              value={value.billingPincode || ''}
              onChange={(e) => onChange({ ...value, billingPincode: e.target.value })}
              disabled={disabled}
              placeholder="6-digit PIN"
              maxLength={6}
              pattern="[0-9]{6}"
              className={`
                w-full px-3 py-2 border rounded-md shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:bg-gray-100 disabled:cursor-not-allowed
                ${error?.billingPincode ? 'border-red-500' : 'border-gray-300'}
              `}
            />
            {error?.billingPincode && (
              <p className="mt-1 text-sm text-red-600">{error.billingPincode}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
          <textarea
            value={value.billingAddress || ''}
            onChange={handleBillingAddressChange}
            disabled={disabled}
            rows={2}
            placeholder="Enter street address, building name, floor, etc."
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${error?.billingAddress ? 'border-red-500' : 'border-gray-300'}
            `}
          />
          {error?.billingAddress && (
            <p className="mt-1 text-sm text-red-600">{error.billingAddress}</p>
          )}
        </div>
      </div>
    </div>
  );
}

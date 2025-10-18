// SMS Setup Info Component
'use client';

import { useState } from 'react';

export default function SmsInfo() {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          📱 SMS Menu Assistant
        </h3>
        <button
          onClick={() => setShowSetup(!showSetup)}
          className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {showSetup ? 'Hide Setup' : 'Show Setup'}
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
            🌿 Text Menu Questions!
          </h4>
          <p className="text-green-700 dark:text-green-300 text-sm mb-3">
            Customers can now text questions about products and get instant answers from live inventory.
          </p>
          
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 border">
            <p className="text-sm font-medium mb-1">SMS Number (Set up required):</p>
            <p className="text-lg font-mono bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
              +1-XXX-XXX-XXXX
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
              Configure your Twilio number below ↓
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
            <h5 className="font-medium mb-2">Example Questions:</h5>
            <ul className="text-neutral-600 dark:text-neutral-400 space-y-1">
              <li>• &quot;THC of Gelato 33&quot;</li>
              <li>• &quot;Stock of OG Kush&quot;</li>
              <li>• &quot;Price of Purple Punch&quot;</li>
              <li>• &quot;Pressure Pack products&quot;</li>
            </ul>
          </div>
          
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
            <h5 className="font-medium mb-2">Features:</h5>
            <ul className="text-neutral-600 dark:text-neutral-400 space-y-1">
              <li>• Live inventory lookup</li>
              <li>• THC percentage info</li>
              <li>• Stock availability</li>
              <li>• Current pricing</li>
            </ul>
          </div>
        </div>

        {showSetup && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 mt-4">
            <h4 className="font-medium mb-3">🔧 Setup Instructions</h4>
            
            <div className="space-y-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  1. Create Twilio Account
                </h5>
                <p className="text-blue-700 dark:text-blue-300 mb-2">
                  Sign up at <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">twilio.com</a> and get a phone number.
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  2. Add Environment Variables
                </h5>
                <p className="text-yellow-700 dark:text-yellow-300 mb-2">
                  Add these to your Vercel environment variables:
                </p>
                <div className="bg-neutral-900 text-green-400 p-3 rounded text-xs font-mono">
                  TWILIO_ACCOUNT_SID=your_account_sid<br/>
                  TWILIO_AUTH_TOKEN=your_auth_token<br/>
                  TWILIO_PHONE_NUMBER=your_twilio_number
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h5 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                  3. Configure Webhook
                </h5>
                <p className="text-purple-700 dark:text-purple-300 mb-2">
                  Set your Twilio webhook URL to:
                </p>
                <div className="bg-neutral-900 text-green-400 p-3 rounded text-xs font-mono break-all">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://your-site.vercel.app'}/api/sms
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  4. Test It Out!
                </h5>
                <p className="text-green-700 dark:text-green-300 mb-2">
                  Text &quot;help&quot; to your Twilio number to see the menu assistant in action.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
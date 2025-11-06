import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface FeatureFlags {
  [key: string]: boolean | string | number;
}

interface FeatureFlagsEditorProps {
  value: FeatureFlags;
  onChange: (flags: FeatureFlags) => void;
}

const commonFeatures = [
  { key: 'showAnalytics', label: 'Show Analytics', type: 'boolean' },
  { key: 'enablePushNotifications', label: 'Push Notifications', type: 'boolean' },
  { key: 'showSearch', label: 'Show Search', type: 'boolean' },
  { key: 'enableOfflineMode', label: 'Offline Mode', type: 'boolean' },
  { key: 'showShareButton', label: 'Share Button', type: 'boolean' },
  { key: 'enableDarkMode', label: 'Dark Mode Toggle', type: 'boolean' },
  { key: 'showFAB', label: 'Floating Action Button', type: 'boolean' },
  { key: 'enableGestures', label: 'Touch Gestures', type: 'boolean' },
];

export const FeatureFlagsEditor = ({ value, onChange }: FeatureFlagsEditorProps) => {
  const [flags, setFlags] = useState<FeatureFlags>(value || {});
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    onChange(flags);
  }, [flags]);

  const updateFlag = (key: string, val: boolean | string | number) => {
    setFlags(prev => ({ ...prev, [key]: val }));
  };

  const addCustomFlag = () => {
    if (customKey && customValue) {
      const val = customValue === 'true' ? true : customValue === 'false' ? false : customValue;
      updateFlag(customKey, val);
      setCustomKey('');
      setCustomValue('');
    }
  };

  const removeFlag = (key: string) => {
    setFlags(prev => {
      const newFlags = { ...prev };
      delete newFlags[key];
      return newFlags;
    });
  };

  const customFlags = Object.keys(flags).filter(
    key => !commonFeatures.find(f => f.key === key)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Common Features</CardTitle>
          <CardDescription>Toggle commonly used features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {commonFeatures.map(feature => (
            <div key={feature.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={feature.key}>{feature.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {feature.key}
                </p>
              </div>
              <Switch
                id={feature.key}
                checked={flags[feature.key] === true}
                onCheckedChange={(checked) => updateFlag(feature.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {customFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Custom Flags</CardTitle>
            <CardDescription>User-defined feature flags</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {customFlags.map(key => (
              <div key={key} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-mono text-xs">{key}</Label>
                  <p className="text-xs text-muted-foreground">
                    {String(flags[key])}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFlag(key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Custom Flag</CardTitle>
          <CardDescription>Create a new custom feature flag</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customKey">Flag Key</Label>
              <Input
                id="customKey"
                placeholder="myCustomFeature"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customValue">Value</Label>
              <Input
                id="customValue"
                placeholder="true / false / value"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={addCustomFlag}
            disabled={!customKey || !customValue}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Flag
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

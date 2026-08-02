/**
 * Icon Usage Examples
 *
 * This file demonstrates how to use both Lucide icons and custom icons
 * in various scenarios within the Garment ERP application.
 */

import React from 'react';

// Lucide Icons
import { Package, Shirt, Scissors, Factory, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

// Custom Icons
import {
  SewingMachineIcon,
  FabricRollIcon,
  MeasuringTapeIcon,
  ThreadSpoolIcon,
  PatternIcon,
  HangerIcon,
  NeedleIcon,
  IronIcon,
  SizeChartIcon,
  LabelIcon,
} from './CustomIcons';

/**
 * Example 1: Basic Icon Usage
 */
export const BasicIconExample = () => {
  return (
    <div className="flex gap-4">
      {/* Lucide Icons */}
      <Package className="h-6 w-6 text-info" />
      <Shirt className="h-6 w-6 text-success" />

      {/* Custom Icons */}
      <SewingMachineIcon size={24} className="text-accent" />
      <FabricRollIcon size={24} className="text-orange-500" />
    </div>
  );
};

/**
 * Example 2: Icons in Buttons
 */
export const IconButtonExample = () => {
  return (
    <div className="flex gap-4">
      <button className="flex items-center gap-2 px-4 py-2 bg-info-muted text-white rounded-md hover:bg-info">
        <Package className="h-5 w-5" />
        <span>Add Stock</span>
      </button>

      <button className="flex items-center gap-2 px-4 py-2 bg-success-muted text-white rounded-md hover:bg-success">
        <Shirt className="h-5 w-5" />
        <span>New Style</span>
      </button>

      <button className="flex items-center gap-2 px-4 py-2 bg-accent/100 text-white rounded-md hover:bg-accent">
        <SewingMachineIcon size={20} />
        <span>Production</span>
      </button>
    </div>
  );
};

/**
 * Example 3: Status Indicators
 */
export const StatusIconExample = () => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-success" />
        <span>Quality Check Passed</span>
      </div>

      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5 text-destructive" />
        <span>Production Failed</span>
      </div>

      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <span>Fabric Stock Low</span>
      </div>
    </div>
  );
};

/**
 * Example 4: Loading States
 */
export const LoadingIconExample = () => {
  return (
    <div className="flex gap-4">
      <Loader2 className="h-6 w-6 animate-spin text-info" />
      <span>Loading production data...</span>
    </div>
  );
};

/**
 * Example 5: Navigation/Menu Icons
 */
export const MenuIconExample = () => {
  const menuItems = [
    { icon: Shirt, label: 'Styles', color: 'text-info' },
    { icon: FabricRollIcon, label: 'Fabric Inventory', color: 'text-success' },
    { icon: SewingMachineIcon, label: 'Production', color: 'text-accent' },
    { icon: MeasuringTapeIcon, label: 'CAD Averages', color: 'text-orange-500' },
    { icon: PatternIcon, label: 'Patterns', color: 'text-pink-500' },
  ];

  return (
    <nav className="space-y-2">
      {menuItems.map((item, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-2 hover:bg-muted rounded-md cursor-pointer">
          {typeof item.icon === 'function'
            ? React.createElement(item.icon, {
                size: 20,
                className: item.color,
              })
            : React.createElement(item.icon, {
                className: `h-5 w-5 ${item.color}`,
              })}
          <span>{item.label}</span>
        </div>
      ))}
    </nav>
  );
};

/**
 * Example 6: Process Steps with Icons
 */
export const ProcessStepsExample = () => {
  const steps = [
    { icon: PatternIcon, title: 'Pattern Creation', completed: true },
    { icon: Scissors, title: 'Cutting', completed: true },
    { icon: SewingMachineIcon, title: 'Sewing', completed: false },
    { icon: IronIcon, title: 'Pressing', completed: false },
    { icon: CheckCircle, title: 'Quality Check', completed: false },
    { icon: HangerIcon, title: 'Packaging', completed: false },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const IconComponent = step.icon;
        return (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-md ${
              step.completed ? 'bg-success-muted border-success/20' : 'bg-muted border-border'
            } border`}
          >
            {typeof IconComponent === 'function'
              ? React.createElement(IconComponent, {
                  size: 24,
                  className: step.completed ? 'text-success' : 'text-muted-foreground',
                })
              : React.createElement(IconComponent, {
                  className: `h-6 w-6 ${step.completed ? 'text-success' : 'text-muted-foreground'}`,
                })}
            <span className={`font-medium ${step.completed ? 'text-success' : 'text-muted-foreground'}`}>
              {step.title}
            </span>
            {step.completed && <CheckCircle className="h-5 w-5 text-success ml-auto" />}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Example 7: Icon Grid/Dashboard
 */
export const IconDashboardExample = () => {
  const cards = [
    { icon: Shirt, label: 'Total Styles', value: '1,234', color: 'bg-info-muted' },
    { icon: FabricRollIcon, label: 'Fabric Rolls', value: '856', color: 'bg-success-muted' },
    { icon: Factory, label: 'Production Lines', value: '12', color: 'bg-accent/100' },
    { icon: Package, label: 'Orders', value: '456', color: 'bg-primary/100' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <div key={index} className="bg-card p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className="text-2xl font-bold mt-2">{card.value}</p>
              </div>
              <div className={`p-3 rounded-full ${card.color}`}>
                {typeof IconComponent === 'function'
                  ? React.createElement(IconComponent, {
                      size: 24,
                      className: 'text-white',
                    })
                  : React.createElement(IconComponent, {
                      className: 'h-6 w-6 text-white',
                    })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Example 8: Material Cards with Custom Icons
 */
export const MaterialCardsExample = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <ThreadSpoolIcon size={32} className="text-info" />
          <div>
            <h3 className="font-semibold">Thread</h3>
            <p className="text-sm text-muted-foreground">345 items</p>
          </div>
        </div>
        <button className="w-full mt-2 px-4 py-2 bg-info-muted text-white rounded-md hover:bg-info">
          View Inventory
        </button>
      </div>

      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <Scissors size={32} className="text-accent" />
          <div>
            <h3 className="font-semibold">Lace</h3>
            <p className="text-sm text-muted-foreground">128 items</p>
          </div>
        </div>
        <button className="w-full mt-2 px-4 py-2 bg-accent/100 text-white rounded-md hover:bg-accent">
          View Inventory
        </button>
      </div>

      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <LabelIcon size={32} className="text-success" />
          <div>
            <h3 className="font-semibold">Labels</h3>
            <p className="text-sm text-muted-foreground">256 items</p>
          </div>
        </div>
        <button className="w-full mt-2 px-4 py-2 bg-success-muted text-white rounded-md hover:bg-success">
          View Inventory
        </button>
      </div>
    </div>
  );
};

/**
 * Example 9: Icon Sizes Reference
 */
export const IconSizesExample = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Shirt className="h-3 w-3" />
        <span>Extra Small (12px)</span>
      </div>
      <div className="flex items-center gap-4">
        <Shirt className="h-4 w-4" />
        <span>Small (16px)</span>
      </div>
      <div className="flex items-center gap-4">
        <Shirt className="h-5 w-5" />
        <span>Medium (20px) - Default</span>
      </div>
      <div className="flex items-center gap-4">
        <Shirt className="h-6 w-6" />
        <span>Large (24px)</span>
      </div>
      <div className="flex items-center gap-4">
        <Shirt className="h-8 w-8" />
        <span>Extra Large (32px)</span>
      </div>
    </div>
  );
};

/**
 * Example 10: All Custom Icons Showcase
 */
export const CustomIconsShowcase = () => {
  const customIcons = [
    { Icon: SewingMachineIcon, name: 'Sewing Machine' },
    { Icon: FabricRollIcon, name: 'Fabric Roll' },
    { Icon: MeasuringTapeIcon, name: 'Measuring Tape' },
    { Icon: ThreadSpoolIcon, name: 'Thread Spool' },
    { Icon: PatternIcon, name: 'Pattern' },
    { Icon: HangerIcon, name: 'Hanger' },
    { Icon: NeedleIcon, name: 'Needle' },
    { Icon: IronIcon, name: 'Iron' },
    { Icon: SizeChartIcon, name: 'Size Chart' },
    { Icon: LabelIcon, name: 'Label' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
      {customIcons.map(({ Icon, name }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon size={48} className="text-primary" />
          <span className="text-sm text-center text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
};

// Main component to showcase all examples
export default function IconExamples() {
  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-display font-medium mb-4">1. Basic Usage</h2>
        <BasicIconExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">2. Icons in Buttons</h2>
        <IconButtonExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">3. Status Indicators</h2>
        <StatusIconExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">4. Loading States</h2>
        <LoadingIconExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">5. Navigation Menu</h2>
        <MenuIconExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">6. Process Steps</h2>
        <ProcessStepsExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">7. Dashboard Cards</h2>
        <IconDashboardExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">8. Material Cards</h2>
        <MaterialCardsExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">9. Icon Sizes</h2>
        <IconSizesExample />
      </div>

      <div>
        <h2 className="text-2xl font-display font-medium mb-4">10. Custom Icons Showcase</h2>
        <CustomIconsShowcase />
      </div>
    </div>
  );
}

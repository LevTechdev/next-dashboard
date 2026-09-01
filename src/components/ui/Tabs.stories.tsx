import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

/**
 * Accessible tabs component using Radix UI primitives.
 *
 * Features:
 * - Keyboard navigation (arrow keys)
 * - Scrollable tab list with progress indicator
 * - Active state styling with shadow
 * - Responsive layout (full-width on mobile)
 * - Content panels with focus management
 */
const meta: Meta<typeof Tabs> = {
  title: "Design System/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="mt-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">Account Settings</h3>
        <p className="text-sm text-gray-500 mt-2">
          Manage your account preferences and profile information.
        </p>
      </TabsContent>
      <TabsContent value="password" className="mt-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">Password</h3>
        <p className="text-sm text-gray-500 mt-2">
          Change your password and manage authentication settings.
        </p>
      </TabsContent>
      <TabsContent value="security" className="mt-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">Security</h3>
        <p className="text-sm text-gray-500 mt-2">
          Configure two-factor authentication and security preferences.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

/** Many tabs to demonstrate scrolling */
export const Scrollable: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full max-w-lg">
      <TabsList>
        {Array.from({ length: 10 }, (_, i) => (
          <TabsTrigger key={`tab${i + 1}`} value={`tab${i + 1}`}>
            Tab {i + 1}
          </TabsTrigger>
        ))}
      </TabsList>
      {Array.from({ length: 10 }, (_, i) => (
        <TabsContent key={`tab${i + 1}`} value={`tab${i + 1}`} className="mt-4 p-4 border rounded-lg">
          <p className="text-sm">Content for Tab {i + 1}</p>
        </TabsContent>
      ))}
    </Tabs>
  ),
};

/** Disabled tab */
export const WithDisabled: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="also-active">Also Active</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4 p-4 border rounded-lg">
        <p className="text-sm">Active tab content</p>
      </TabsContent>
      <TabsContent value="also-active" className="mt-4 p-4 border rounded-lg">
        <p className="text-sm">Another active tab content</p>
      </TabsContent>
    </Tabs>
  ),
};

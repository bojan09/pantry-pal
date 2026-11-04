import { Card, PageHeader } from '@/design/ui';

const Item = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <li className="grid gap-1">
    <h3 className="text-lg font-semibold">{t}</h3>
    <p className="text-ink-soft">{children}</p>
  </li>
);

export function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Privacy"
        subtitle="What PantryPal stores, and what it does not do."
        back="/settings"
      />
      <Card>
        <ul className="grid max-w-3xl gap-5">
          <Item t="Your data stays on this device">
            Everything you enter (pantry, recipes, plans, lists, photos, settings) is saved in this
            browser using IndexedDB and local storage. PantryPal has no server of its own, no
            database in the cloud and no user accounts, so there is nothing to sign in to and
            nothing that can be synced, shared or recovered for you.
          </Item>
          <Item t="Nothing is sent anywhere">
            The app makes no analytics, tracking, advertising or error-reporting requests. Fonts,
            icons, illustrations and the starter cookbook are bundled and work offline. After the
            first visit it does not need the internet.
          </Item>
          <Item t="The website host">
            The files that make up the app are delivered by a static web host. Like any website, the
            host may keep ordinary server logs of page requests (such as your IP address and the
            time). PantryPal itself adds nothing to those requests and the host never receives your
            pantry data.
          </Item>
          <Item t="Photos">
            Recipe photos, your profile picture and a custom background are resized and stored only
            in this browser. They are never uploaded.
          </Item>
          <Item t="Backups are yours to protect">
            A backup is a plain JSON file with all your data. It is not encrypted. Keep it somewhere
            private, and delete old copies you no longer need. Restoring checks the file before
            changing anything.
          </Item>
          <Item t="Data can disappear">
            Browsers can clear site data when storage is low, when you clear history, or when you
            remove the app. Back up regularly and consider asking the browser to protect the data
            under Settings → Storage.
          </Item>
          <Item t="Allergies, diets and dates">
            Allergen and diet filters use only the ingredient data and tags saved in the app, which
            can be incomplete. Dates are what you enter from the package. PantryPal gives no medical
            or food-safety advice: always read labels and use your own judgement.
          </Item>
          <Item t="Deleting everything">
            Settings → Delete my data removes everything you created from this browser. Clearing the
            site&apos;s data in your browser settings does the same.
          </Item>
        </ul>
      </Card>
    </>
  );
}

import { Helmet } from 'react-helmet-async';

import WinterCampaignReview from 'src/sections/winter-campaign/winter-campaign-review';

export default function WinterCampaignReviewPage() {
  return (
    <>
      <Helmet>
        <title>Winter Campaign | Refex</title>
      </Helmet>
      <WinterCampaignReview />
    </>
  );
}

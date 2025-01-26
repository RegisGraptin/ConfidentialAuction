import { NextPage } from "next";
import CreateConfidentialAuction from "../../../components/CreateConfidentialAuction";

const CreateAuctionPage: NextPage = () => {
  // http://localhost:3000/auction/0xa3757957bde26f6581b81b0363e00f635628c4e4

  return (
    <>
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Create your confidential auction
          </h1>
          <p className="text-lg md:text-xl mb-8">
            Launch your token securely and bid with confidence on our sealed-bid
            auction platform.
          </p>
        </div>
        <CreateConfidentialAuction />
      </section>
    </>
  );
};

export default CreateAuctionPage;

source .env

forge script script/PrivateAuction.s.sol:PrivateAuctionScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify \
  --verifier blockscout \
  --verifier-url https://eth-sepolia.blockscout.com/api/ \
  --broadcast

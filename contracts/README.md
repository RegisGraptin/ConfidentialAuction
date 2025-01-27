## Confidential Auction - Smart contract

For our approach, we are using foundry for the smart contract development. Regarding tests scenarios, we are using hardhat, simplifying the FHE mechanism needed for encryption and Gateway workflow.

## Documentation

https://book.getfoundry.sh/

## Usage

```shell
$ forge install
$ forge build
```

## Tests

```shell
$ pnpm install
$ npx hardhat test
```

## Deploy

For the deployment, we provide a script that is loading the environment variable and call our forge script to deploy it. Feel free to update the forge script to customize your auction.

First, you will need to copy .env.example and fill the variables. Then, you can call the `deploy.sh` script.

```shell
$ ./deploy.sh
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

import { initFhevm, createInstance, FhevmInstance } from "fhevmjs/bundle";

let instance: FhevmInstance;

export const createFHEInstance = async () => {
    await initFhevm();
    instance = await createInstance({
        networkUrl: "https://eth-sepolia.public.blastapi.io",
        gatewayUrl: "https://gateway.sepolia.zama.ai",
        kmsContractAddress: "0x9D6891A6240D6130c54ae243d8005063D05fE14b",
        aclContractAddress: "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5",
    });
  };

  
export const getFHEInstance = (): FhevmInstance => {
    return instance;
};

import { networks } from 'bitcoinjs-lib';
import { IWBTCContract, JSONRpcProvider, WBTC_ABI, getContract } from 'opnet';

import { Account } from '@/shared/types';
import { Button, Card, Column, Content, Footer, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import RunesPreviewCard from '@/ui/components/RunesPreviewCard';
import { useLocationState, useWallet } from '@/ui/utils';
import { ABICoder, BinaryWriter } from '@btc-vision/bsi-binary';
import {
  FetchUTXOParamsMultiAddress,
  IInteractionParameters,
  IUnwrapParameters,
  IWrapParameters,
  OPNetLimitedProvider,
  TransactionFactory,
  UTXO,
  Wallet
} from '@btc-vision/transaction';

import { useNavigate } from '../MainRoute';

interface LocationState {
  rawTxInfo: any;
}

export default function TxOpnetConfirmScreen() {
  const navigate = useNavigate();

  const { rawTxInfo } = useLocationState<LocationState>();
  console.log(rawTxInfo);
  const handleCancel = () => {
    console.log();
  };
  const wallet = useWallet();
  const tools = useTools();
  const handleConfirm = async () => {
    const foundObject = rawTxInfo.items.find((obj) => obj.account && obj.account.address === rawTxInfo.account.address);
    const wifWallet = await wallet.getInternalPrivateKey(foundObject?.account as Account);
    const walletGet: Wallet = Wallet.fromWif(wifWallet.wif, networks.regtest);
    const opnetNode = 'https://regtest.opnet.org';
    const utxoManager = new OPNetLimitedProvider(opnetNode);
    const factory: TransactionFactory = new TransactionFactory(); // Transaction factory
    const abiCoder: ABICoder = new ABICoder();
    const transferSelector = Number(`0x` + abiCoder.encodeSelector('transfer'));

    console.log(walletGet);
    function getTransferToCalldata(to: string, amount: bigint): Buffer {
      const addCalldata: BinaryWriter = new BinaryWriter();
      addCalldata.writeSelector(transferSelector);
      addCalldata.writeAddress(to);
      addCalldata.writeU256(amount);
      return Buffer.from(addCalldata.getBuffer());
    }

    try {
      const result = 10 ** rawTxInfo.opneTokens[0].divisibility;
      const amountToSend = BigInt(rawTxInfo.inputAmount * result); // Amount to send
      const calldata = getTransferToCalldata(rawTxInfo.address, amountToSend);
      const utxoSetting: FetchUTXOParamsMultiAddress = {
        addresses: [walletGet.p2wpkh, walletGet.p2tr],
        minAmount: 10000n,
        requestedAmount: BigInt(amountToSend)
      };
      console.log(walletGet.p2wpkh, walletGet.p2tr);

      const utxos: UTXO[] = await utxoManager.fetchUTXOMultiAddr(utxoSetting);
      console.log(utxos);
      if (!utxos.length) {
        throw new Error('No UTXOs found');
      }
      const interactionParameters: IInteractionParameters = {
        from: walletGet.p2tr, // From address
        to: rawTxInfo.contractAddress, // To address
        utxos: utxos, // UTXOs
        signer: walletGet.keypair, // Signer
        network: networks.regtest, // Network
        feeRate: 300, // Fee rate (satoshi per byte)
        priorityFee: BigInt(rawTxInfo.OpnetRateInputVal), // Priority fee (opnet)
        calldata: calldata // Calldata
      };
      console.log(interactionParameters);
      // Sign and broadcast the transaction
      const finalTx = await factory.signInteraction(interactionParameters);
      console.log(finalTx);
      const provider: JSONRpcProvider = new JSONRpcProvider('https://regtest.opnet.org');

      const firstTxBroadcast = await provider.sendRawTransaction(finalTx[0], false);
      console.log(`First transaction broadcasted: ${firstTxBroadcast.result}`);

      if (!firstTxBroadcast.success) {
        throw new Error('Could not broadcast first transaction');
      }

      const secondTxBroadcast = await provider.sendRawTransaction(finalTx[1], false);
      console.log(`Second transaction broadcasted: ${secondTxBroadcast.result}`);

      if (!secondTxBroadcast.success) {
        throw new Error('Could not broadcast second transaction');
      }
      tools.toastSuccess(`"You have sucessfully transferd ${amountToSend} Bitcoin"`);
      navigate('TxSuccessScreen', { secondTxBroadcast });
    } catch (e) {
      console.log(e);
    }
  };

  const handleWrapConfirm = async () => {
    const foundObject = rawTxInfo.items.find((obj) => obj.account && obj.account.address === rawTxInfo.account.address);
    const wifWallet = await wallet.getInternalPrivateKey(foundObject?.account as Account);
    const walletGet: Wallet = Wallet.fromWif(wifWallet.wif, networks.regtest);
    const opnetNode = 'https://regtest.opnet.org';
    const opnet: OPNetLimitedProvider = new OPNetLimitedProvider(opnetNode);
    const factory: TransactionFactory = new TransactionFactory(); // Transaction factory
    const abiCoder: ABICoder = new ABICoder();
    const result = 10 ** 9;

    const amountToSend = BigInt(rawTxInfo.inputAmount * result);
    const wrapAmount = amountToSend; // 1 BTC in satoshis
    const utxoSetting: FetchUTXOParamsMultiAddress = {
      addresses: [walletGet.p2wpkh, walletGet.p2tr],
      minAmount: 10000n,
      requestedAmount: wrapAmount
    };

    const utxos: UTXO[] = await opnet.fetchUTXOMultiAddr(utxoSetting);
    if (!utxos) {
      throw new Error('No UTXOs found');
    }
    console.log(utxos);
    const generationParameters = await opnet.fetchWrapParameters(wrapAmount);
    if (!generationParameters) {
      throw new Error('No generation parameters found');
    }
    const wrapParameters: IWrapParameters = {
      from: walletGet.p2tr,
      utxos: utxos,
      signer: walletGet.keypair,
      network: networks.regtest,
      feeRate: 400,
      priorityFee: BigInt(rawTxInfo.OpnetRateInputVal),
      amount: wrapAmount,
      generationParameters: generationParameters
    };
    console.log(wrapParameters);
    const finalTx = await factory.wrap(wrapParameters);
    console.log(`Final transaction:`, finalTx);
    const provider: JSONRpcProvider = new JSONRpcProvider('https://regtest.opnet.org');
    const firstTxBroadcast = await provider.sendRawTransaction((await finalTx).transaction[0], false);
    if (!firstTxBroadcast) {
      tools.toastError(`Error,Please Try again`);
      throw new Error('Could not broadcast first transaction');
    } else {
      console.log(firstTxBroadcast);
    }
    const secondTxBroadcast = await provider.sendRawTransaction((await finalTx).transaction[1], false);
    if (!secondTxBroadcast) {
      tools.toastError(`Error,Please Try again`);
      throw new Error('Could not broadcast first transaction');
    } else {
      console.log(`Second transaction broadcasted:`, secondTxBroadcast);
      console.log(secondTxBroadcast);
    }
    console.log('finish');
    tools.toastSuccess(`"You have sucessfully wraped ${wrapAmount} Bitcoin"`);
    navigate('TxSuccessScreen', { secondTxBroadcast });
  };
  const handleUnWrapConfirm = async () => {
    const foundObject = rawTxInfo.items.find((obj) => obj.account && obj.account.address === rawTxInfo.account.address);
    const wifWallet = await wallet.getInternalPrivateKey(foundObject?.account as Account);
    const walletGet: Wallet = Wallet.fromWif(wifWallet.wif, networks.regtest);
    const opnetNode = 'https://regtest.opnet.org';
    const opnet: OPNetLimitedProvider = new OPNetLimitedProvider(opnetNode);
    const factory: TransactionFactory = new TransactionFactory(); // Transaction factory
    const abiCoder: ABICoder = new ABICoder();
    const result = 10 ** 9;

    const amountToSend = BigInt(rawTxInfo.inputAmount * result);

    const unwrapAmount = amountToSend; // Minimum amount to unwrap
    const requestWithdrawalSelector = Number(`0x` + abiCoder.encodeSelector('requestWithdrawal'));

    function generateCalldata(unwrapAmount: bigint): Buffer {
      const addCalldata: BinaryWriter = new BinaryWriter();
      addCalldata.writeSelector(requestWithdrawalSelector);
      addCalldata.writeU256(unwrapAmount);
      return Buffer.from(addCalldata.getBuffer());
    }

    const utxoSetting: FetchUTXOParamsMultiAddress = {
      addresses: [walletGet.p2wpkh, walletGet.p2tr],
      minAmount: 10000n,
      requestedAmount: unwrapAmount
    };

    const utxos: UTXO[] = await opnet.fetchUTXOMultiAddr(utxoSetting);
    if (!utxos) {
      throw new Error('No UTXOs found');
    }
    const calldata = generateCalldata(unwrapAmount);
    console.log(calldata);

    const provider: JSONRpcProvider = new JSONRpcProvider('https://regtest.opnet.org');
    const contract: IWBTCContract = getContract<IWBTCContract>(
      'bcrt1q99qtptumw027cw8w274tqzd564q66u537vn0lh',
      WBTC_ABI,
      provider,
      walletGet.p2tr
    );
    const withdrawalRequest = await contract.requestWithdrawal(unwrapAmount);
    console.log(unwrapAmount);
    console.log(withdrawalRequest);
    if ('error' in withdrawalRequest) {
      throw new Error('Invalid calldata in withdrawal request');
    }
    const interactionParameters: IInteractionParameters = {
      from: walletGet.p2tr,
      to: contract.address.toString(),
      utxos: utxos,
      signer: walletGet.keypair,
      network: networks.regtest,
      feeRate: 450,
      priorityFee: 50000n,
      calldata: withdrawalRequest.calldata as Buffer
    };
    console.log(interactionParameters);
    const sendTransact = await factory.signInteraction(interactionParameters);

    // If this transaction is missing, opnet will deny the unwrapping request.
    const firstTransaction = await provider.sendRawTransaction(sendTransact[0], false);
    if (!firstTransaction) {
      console.log(`Broadcasted:`, false);
    } else {
      console.log(`Broadcasted:`, firstTransaction);
    }

    // This transaction is partially signed. You can not submit it to the Bitcoin network. It must pass via the OPNet network.
    const seconfTransaction = await provider.sendRawTransaction(sendTransact[1], false);
    if (!seconfTransaction) {
      console.log(`Broadcasted:`, false);
    } else {
      console.log(`Broadcasted:`, seconfTransaction);
    }
    const unwrapUtxos = await opnet.fetchUnWrapParameters(unwrapAmount, walletGet.p2tr);
    if (!unwrapUtxos) {
      throw new Error('No vault UTXOs or something went wrong. Please try again.');
    }

    const unwrapParameters: IUnwrapParameters = {
      from: walletGet.p2tr, // Address to unwrap
      utxos: utxos, // User UTXOs to spend
      unwrapUTXOs: unwrapUtxos.vaultUTXOs, // Vault UTXOs to unwrap
      signer: walletGet.keypair, // Signer
      network: networks.regtest, // Bitcoin network
      feeRate: 100, // Fee rate in satoshis per byte (bitcoin fee)
      priorityFee: 10000n, // OPNet priority fee (incl gas.)
      amount: unwrapAmount,
      calldata: calldata
    };

    try {
      const finalTx = await factory.unwrap(unwrapParameters);
      console.log(
        `Due to bitcoin fees, you will lose ${finalTx.feeRefundOrLoss} satoshis by unwrapping. Do you want to proceed?`
      );
      console.log(`Final transaction:`, finalTx);

      // If this transaction is missing, opnet will deny the unwrapping request.
      const fundingTransaction = await provider.sendRawTransaction(finalTx.fundingTransaction, false);
      console.log(`Broadcasted:`, fundingTransaction);

      // This transaction is partially signed. You can not submit it to the Bitcoin network. It must pass via the OPNet network.
      const unwrapTransaction = await provider.sendRawTransaction(finalTx.psbt, true);
      console.log(`Broadcasted:`, unwrapTransaction);
      tools.toastSuccess(`"You have sucessfully unwraped ${unwrapAmount} Bitcoin"`);
      navigate('TxSuccessScreen', { unwrapTransaction });
    } catch (e) {
      console.error(`Error:`, e);
    }
    console.log('finish');
  };
  return (
    <Layout>
      {rawTxInfo.header}
      <Content>
        <Column gap="xl">
          <Section title="Network Fee Rate:">
            <Text text={rawTxInfo.feeRate.toString()} />

            <Text text="sat/vB" color="textDim" />
          </Section>
          i c
          <Section title="Opnet Fee Rate:">
            <Text text={rawTxInfo.OpnetRateInputVal.toString()} />

            <Text text="sat/vB" color="textDim" />
          </Section>
          <Section title="Features:">
            <Row>
              {rawTxInfo.features.rbf ? (
                <Text text="RBF" color="white" style={{ backgroundColor: 'green', padding: 5, borderRadius: 5 }} />
              ) : (
                <Text
                  text="RBF"
                  color="white"
                  style={{ backgroundColor: 'red', padding: 5, borderRadius: 5, textDecoration: 'line-through' }}
                />
              )}
            </Row>
          </Section>
          <Column gap="xl">
            <Column>
              <Text text={`Inputs: (${rawTxInfo.inputInfos.length})`} preset="bold" />
              <Card>
                <Column full justifyCenter>
                  <Row>
                    <Column justifyCenter>
                      <Text text={'RUNES'} color={rawTxInfo.isToSign ? 'white' : 'textDim'} />
                      <Row overflowX gap="lg" style={{ width: 280 }} pb="lg">
                        {rawTxInfo.opneTokens.map((w, index) => (
                          <RunesPreviewCard key={index} balance={w} />
                        ))}
                      </Row>
                    </Column>
                  </Row>
                </Column>
              </Card>
            </Column>
          </Column>
        </Column>
      </Content>

      <Footer>
        <Row full>
          <Button preset="default" text="Reject" onClick={handleCancel} full />
          <Button
            preset="primary"
            icon={undefined}
            text={'Sign'}
            onClick={() => {
              if (rawTxInfo.action == 'wrap') {
                handleWrapConfirm();
              } else if (rawTxInfo.action == 'unwrap') {
                handleUnWrapConfirm();
              } else {
                handleConfirm();
              }
            }}
            full
          />
        </Row>
      </Footer>
    </Layout>
  );
}
function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Column>
      <Text text={title} preset="bold" />
      <Card>
        <Row full justifyBetween itemsCenter>
          {children}
        </Row>
      </Card>
    </Column>
  );
}

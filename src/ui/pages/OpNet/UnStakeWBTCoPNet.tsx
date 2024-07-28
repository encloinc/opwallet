import { IWBTCContract, WBTC_ABI, getContract } from 'opnet';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Account, OpNetBalance, RawTxInfo } from '@/shared/types';
import { addressShortner } from '@/shared/utils';
import Web3API from '@/shared/web3/Web3API';
import { Button, Content, Header, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useCurrentKeyring } from '@/ui/state/keyrings/hooks';
import {
  useFetchAssetUtxosRunesCallback,
  useFetchUtxosCallback,
  usePrepareSendRunesCallback,
  useRunesTx
} from '@/ui/state/transactions/hooks';
import { useWallet } from '@/ui/utils';
import { wBTC } from '@btc-vision/transaction';

import { useNavigate } from '../MainRoute';

interface ItemData {
  key: string;
  account?: Account;
}
export default function UnWrapBitcoinOpnet() {
  const { state } = useLocation();
  const props = state as {
    OpNetBalance: OpNetBalance;
  };

  const OpNetBalance = props.OpNetBalance;
  const account = useCurrentAccount();

  const navigate = useNavigate();
  const runesTx = useRunesTx();
  const [inputAmount, setInputAmount] = useState('');
  const [disabled, setDisabled] = useState(true);
  const [OpnetRateInputVal, adjustFeeRateInput] = useState('800');
  const [stakedReward, setStakeReward] = useState<bigint>(0n);
  const [stakedAmount, setStakedAmount] = useState<bigint>(0n);
  const wallet = useWallet();

  const [availableBalance, setAvailableBalance] = useState('0');
  const [error, setError] = useState('');

  const defaultOutputValue = 546;

  const [outputValue, setOutputValue] = useState(defaultOutputValue);

  const fetchUtxos = useFetchUtxosCallback();

  const fetchAssetUtxosRunes = useFetchAssetUtxosRunesCallback();
  const $style = { maxWidth: '350px', marginRight: 'auto', marginLeft: 'auto', width: '100%' } as CSSProperties;

  const tools = useTools();
  useEffect(() => {
    const setWallet = async () => {
      Web3API.setNetwork(await wallet.getChainType());
      const contract: IWBTCContract = await getContract<IWBTCContract>(
        wBTC.getAddress(Web3API.network),
        WBTC_ABI,
        Web3API.provider,
        account.address
      );
      const getRewards = (await contract.stakedReward(account.address)) as unknown as { decoded: bigint[] };
      const getStakedAmount = (await contract.stakedAmount(account.address)) as unknown as { decoded: bigint[] };

      if ('error' in getRewards || 'error' in getStakedAmount) {
        throw new Error('getRewards');
      }

      setStakeReward(getRewards.decoded[0]);
      setStakedAmount(getStakedAmount.decoded[0]);
    };
    setWallet();
    fetchUtxos();
    setAvailableBalance((parseInt(OpNetBalance.amount.toString()) / 10 ** OpNetBalance.divisibility).toString());
    tools.showLoading(false);
  }, []);

  const prepareSendRunes = usePrepareSendRunesCallback();

  const [feeRate, setFeeRate] = useState(5);
  const [enableRBF, setEnableRBF] = useState(false);
  const [rawTxInfo, setRawTxInfo] = useState<RawTxInfo>();
  const keyring = useCurrentKeyring();
  const items = useMemo(() => {
    const _items: ItemData[] = keyring.accounts.map((v) => {
      return {
        key: v.address,
        account: v
      };
    });
    return _items;
  }, []);

  useEffect(() => {
    setError('');
    setDisabled(true);

    if (!inputAmount) {
      return;
    }

    if (inputAmount != '') {
      //Prevent repeated triggering caused by setAmount
      setDisabled(false);
      return;
    }
  }, [inputAmount, feeRate, enableRBF]);
  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={'Your Stake'}
      />
      <Content style={$style}>
        <Row itemsCenter fullX justifyBetween>
          <Text text={'Address'} color="textDim" size="md" />
          <Text text={addressShortner(account.address)} size="md" />
        </Row>
        <Row itemsCenter fullX justifyBetween>
          <Text text={'Balance'} size="md" color="textDim" />
          <Text text={(Number(OpNetBalance.amount) / 10 ** OpNetBalance.divisibility).toString()} size="md" />
        </Row>
        <Row itemsCenter fullX justifyBetween>
          <Text text={'Active Stake'} color="textDim" size="md" />
          <Text text={(Number(stakedAmount) / 10 ** OpNetBalance.divisibility).toString()} size="md" />
        </Row>
        <Row itemsCenter fullX justifyBetween>
          <Text text={'Reward'} color="textDim" size="md" />
          <Text text={(Number(stakedReward) / 10 ** OpNetBalance.divisibility).toString()} size="md" />
        </Row>
        <Row full>
          <Button
            preset="default"
            style={{ height: '42px' }}
            text="Claim"
            full
            onClick={(e) => {
              navigate('TxOpnetConfirmScreen', {
                rawTxInfo: {
                  items: items,
                  account: account,
                  inputAmount: Number(stakedReward) / 10 ** OpNetBalance.divisibility, // replace with actual inputAmount
                  address: wBTC.getAddress(Web3API.network), // replace with actual address
                  feeRate: feeRate, // replace with actual feeRate
                  OpnetRateInputVal: OpnetRateInputVal, // replace with actual OpnetRateInputVal
                  header: 'Stake WBTC', // replace with actual header
                  networkFee: feeRate, // replace with actual networkFee
                  features: {
                    rbf: false // replace with actual rbf value
                  },
                  inputInfos: [], // replace with actual inputInfos
                  isToSign: false, // replace with actual isToSign value
                  opneTokens: [
                    {
                      amount: Number(stakedReward),
                      divisibility: OpNetBalance.divisibility,
                      spacedRune: OpNetBalance.name,
                      symbol: OpNetBalance.symbol
                    }
                  ],
                  action: 'claim' // replace with actual opneTokens
                }
              });
            }}
          />

          <Button
            disabled={false}
            style={{ height: '42px' }}
            preset="primary"
            text="Unstake"
            onClick={(e) => {
              navigate('TxOpnetConfirmScreen', {
                rawTxInfo: {
                  items: items,
                  account: account,
                  inputAmount: Number(stakedAmount) / 10 ** OpNetBalance.divisibility, // replace with actual inputAmount
                  address: wBTC.getAddress(Web3API.network), // replace with actual address
                  feeRate: feeRate, // replace with actual feeRate
                  OpnetRateInputVal: OpnetRateInputVal, // replace with actual OpnetRateInputVal
                  header: 'Stake WBTC', // replace with actual header
                  networkFee: feeRate, // replace with actual networkFee
                  features: {
                    rbf: false // replace with actual rbf value
                  },
                  inputInfos: [], // replace with actual inputInfos
                  isToSign: false, // replace with actual isToSign value
                  opneTokens: [
                    {
                      amount: Number(stakedAmount),
                      divisibility: OpNetBalance.divisibility,
                      spacedRune: OpNetBalance.name,
                      symbol: OpNetBalance.symbol
                    }
                  ],
                  action: 'unstake' // replace with actual opneTokens
                }
              });
            }}
            full></Button>
        </Row>
      </Content>
    </Layout>
  );
}
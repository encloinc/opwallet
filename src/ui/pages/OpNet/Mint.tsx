import { IOP_20Contract, OP_20_ABI, getContract } from 'opnet';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { runesUtils } from '@/shared/lib/runes-utils';
import { Account, Inscription, OpNetBalance, RawTxInfo } from '@/shared/types';
import { expandToDecimals } from '@/shared/utils';
import Web3API from '@/shared/web3/Web3API';
import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { FeeRateBar } from '@/ui/components/FeeRateBar';
import { OutputValueBar } from '@/ui/components/OutputValueBar';
import { RBFBar } from '@/ui/components/RBFBar';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useCurrentKeyring } from '@/ui/state/keyrings/hooks';
import {
  useFetchAssetUtxosRunesCallback,
  useFetchUtxosCallback,
  usePrepareSendRunesCallback,
  useRunesTx
} from '@/ui/state/transactions/hooks';
import { colors } from '@/ui/theme/colors';
import { useWallet } from '@/ui/utils';
import { getAddressUtxoDust } from '@unisat/wallet-sdk/lib/transaction';

import { useNavigate } from '../MainRoute';

interface ItemData {
  key: string;
  account?: Account;
}
export default function Mint() {
  const { state } = useLocation();
  const props = state as {
    OpNetBalance: OpNetBalance;
  };
  interface IOP_20ContractWithMaxSupply extends IOP_20Contract {
    maximumSupply(): any;
  }

  const OpNetBalance = props.OpNetBalance;
  const account = useCurrentAccount();

  const navigate = useNavigate();
  const runesTx = useRunesTx();
  const [inputAmount, setInputAmount] = useState('');
  const [disabled, setDisabled] = useState(true);
  const [OpnetRateInputVal, adjustFeeRateInput] = useState('800');
  const [toInfo, setToInfo] = useState<{
    address: string;
    domain: string;
    inscription?: Inscription;
  }>({
    address: runesTx.toAddress,
    domain: runesTx.toDomain,
    inscription: undefined
  });

  const [availableBalance, setAvailableBalance] = useState('0');
  const [error, setError] = useState('');

  const defaultOutputValue = 546;

  const [outputValue, setOutputValue] = useState(defaultOutputValue);
  const minOutputValue = useMemo(() => {
    if (toInfo.address) {
      return getAddressUtxoDust(toInfo.address);
    } else {
      return 0;
    }
  }, [toInfo.address]);

  const fetchUtxos = useFetchUtxosCallback();

  const fetchAssetUtxosRunes = useFetchAssetUtxosRunesCallback();
  const tools = useTools();
  useEffect(() => {
    fetchUtxos();
    setAvailableBalance((parseInt(OpNetBalance.amount.toString()) / 10 ** OpNetBalance.divisibility).toString());
    tools.showLoading(false);
  }, []);

  const prepareSendRunes = usePrepareSendRunesCallback();

  const [feeRate, setFeeRate] = useState(5);
  const [enableRBF, setEnableRBF] = useState(false);
  const wallet = useWallet();
  const [maxSupply, setMaxSupply] = useState<bigint>(0n);
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
    const setWallet = async () => {
      Web3API.setNetwork(await wallet.getChainType());
      const contract: IOP_20ContractWithMaxSupply = getContract<IOP_20ContractWithMaxSupply>(
        OpNetBalance.address,
        OP_20_ABI,
        Web3API.provider
      );
      const maxSupply = await contract.maximumSupply();
      const totalSupply = await contract.totalSupply();

      if ('error' in maxSupply || 'error' in totalSupply) {
        console.error('Error fetching supply:', maxSupply.error || totalSupply);
        return;
      }
      setMaxSupply(BigInt((maxSupply.decoded[0] as bigint) - (totalSupply.decoded[0] as bigint)));
    };
    setWallet();

    if (!inputAmount) {
      return;
    }

    if ((toInfo.address != '', inputAmount != '')) {
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
        title={'Mint ' + OpNetBalance.name}
      />
      <Content>
        {/* <Row itemsCenter fullX justifyCenter>
          {OpNetBalance.logo && <Image src={OpNetBalance.logo} size={fontSizes.tiny} />}
          <Text
            text={`${runesUtils.toDecimalAmount(OpNetBalance.amount.toString(), OpNetBalance.divisibility)} ${
              OpNetBalance.symbol
            } `}
            preset="bold"
            textCenter
            size="xxl"
            wrap
          />
        </Row> */}

        <Column mt="lg">
          <Row justifyBetween>
            <Text text="Amount" color="textDim" />
            <Row
              itemsCenter
              onClick={() => {
                setInputAmount(runesUtils.toDecimalAmount(maxSupply.toString(), OpNetBalance.divisibility));
              }}>
              <Text text="MAX" preset="sub" style={{ color: colors.white_muted }} />
              <Text
                text={`${runesUtils.toDecimalAmount(maxSupply.toString(), OpNetBalance.divisibility)} `}
                preset="bold"
                size="sm"
                wrap
              />
            </Row>
          </Row>
          <Input
            preset="amount"
            placeholder={'Amount'}
            value={inputAmount.toString()}
            onAmountInputChange={(amount) => {
              const numAmount = Number(amount);
              if (numAmount <= Number(maxSupply) / 10 ** OpNetBalance.divisibility) {
                setInputAmount(amount);
              } else {
                setInputAmount(runesUtils.toDecimalAmount(maxSupply.toString(), OpNetBalance.divisibility));
              }
            }}
            runesDecimal={OpNetBalance.divisibility}
          />
        </Column>

        {toInfo.address ? (
          <Column mt="lg">
            <Text text="OutputValue" color="textDim" />

            <OutputValueBar
              defaultValue={defaultOutputValue}
              minValue={minOutputValue}
              onChange={(val) => {
                setOutputValue(val);
              }}
            />
          </Column>
        ) : null}

        <Column mt="lg">
          <Text text="Fee" color="textDim" />

          <FeeRateBar
            onChange={(val) => {
              setFeeRate(val);
            }}
          />
        </Column>
        <Text text="Opnet Fee" color="textDim" />
        <Input
          preset="amount"
          placeholder={'sat/vB'}
          value={OpnetRateInputVal}
          onAmountInputChange={(amount) => {
            adjustFeeRateInput(amount);
          }}
          autoFocus={true}
        />
        <Column mt="lg">
          <RBFBar
            onChange={(val) => {
              setEnableRBF(val);
            }}
          />
        </Column>

        {error && <Text text={error} color="error" />}

        <Button
          disabled={disabled}
          preset="primary"
          text="Next"
          onClick={(e) => {
            navigate('TxOpnetConfirmScreen', {
              rawTxInfo: {
                items: items,
                contractAddress: OpNetBalance.address,
                account: account,
                inputAmount: expandToDecimals(inputAmount, OpNetBalance.divisibility),
                address: toInfo.address,
                feeRate: feeRate,
                priorityFee: BigInt(OpnetRateInputVal),
                header: 'Mint Token',
                networkFee: feeRate,
                features: {
                  rbf: false
                },
                inputInfos: [],
                isToSign: false,
                opneTokens: [
                  {
                    amount: parseFloat(inputAmount) * 10 ** OpNetBalance.divisibility,
                    divisibility: OpNetBalance.divisibility,
                    spacedRune: OpNetBalance.name,
                    symbol: OpNetBalance.symbol
                  }
                ],
                action: 'mint' // replace with actual opneTokens
              }
            });
          }}></Button>
      </Content>
    </Layout>
  );
}
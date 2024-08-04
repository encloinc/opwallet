import { getContract, IOP_20Contract, JSONRpcProvider, OP_20_ABI } from 'opnet';
import { CSSProperties, useEffect, useState } from 'react';

import { OpNetBalance } from '@/shared/types';
import Web3API from '@/shared/web3/Web3API';
import { ContractInformation } from '@/shared/web3/interfaces/ContractInformation';
import { Button, Column, Row } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { BaseView } from '@/ui/components/BaseView';
import OpNetBalanceCard from '@/ui/components/OpNetBalanceCard';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useWallet } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';
import {
    MOTO_ADDRESS_REGTEST,
    MOTO_ADDRESS_TESTNET,
    WBTC_ADDRESS_REGTEST,
    WBTC_ADDRESS_TESTNET
} from '@btc-vision/transaction';

import { useNavigate } from '../../MainRoute';
import { AddOpNetToken } from '../../Wallet/AddOpNetToken';

const { AddressType } = require('@unisat/wallet-sdk');
const { bitcoin } = require('@unisat/wallet-sdk/lib/bitcoin-core');
const { NetworkType } = require('@unisat/wallet-sdk/lib/network');

export function OPNetList() {
    const navigate = useNavigate();
    const wallet = useWallet();
    const currentAccount = useCurrentAccount();

    const [tokens, setTokens] = useState<any[]>([]);
    const [total, setTotal] = useState(-1);
    const [data, setData] = useState<string>();
    const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });
    const [importTokenBool, setImportTokenBool] = useState(false);

    const tools = useTools();
    const fetchData = async () => {
        try {
            setTotal(-1);
            await wallet.getNetworkType();

            // await wallet.changeAddressType(AddressType.P2TR);
            const getChain = await wallet.getChainType();
            Web3API.setNetwork(getChain);

            const tokensImported = localStorage.getItem('tokensImported_' + getChain);
            let parsedTokens: string[] = [];
            if (tokensImported) {
                parsedTokens = JSON.parse(tokensImported);
            }

            const currentNetwork = await wallet.getNetworkType();

            switch (currentNetwork) {
                case NetworkType.MAINNET: {
                    break;
                }
                case NetworkType.TESTNET: {
                    if (!parsedTokens.includes(WBTC_ADDRESS_TESTNET)) {
                        parsedTokens.push(WBTC_ADDRESS_TESTNET);
                    }
                    if (!parsedTokens.includes(MOTO_ADDRESS_TESTNET)) {
                        parsedTokens.push(MOTO_ADDRESS_TESTNET);
                    }
                    break;
                }
                case NetworkType.REGTEST: {
                    if (!parsedTokens.includes(WBTC_ADDRESS_REGTEST)) {
                        parsedTokens.push(WBTC_ADDRESS_REGTEST);
                    }
                    if (!parsedTokens.includes(MOTO_ADDRESS_REGTEST)) {
                        parsedTokens.push(MOTO_ADDRESS_REGTEST);
                    }
                    break;
                }
            }

            if (parsedTokens.length) {
                localStorage.setItem('tokensImported_' + getChain, JSON.stringify(parsedTokens));
            }

            const tokenBalances: OpNetBalance[] = [];
            for (let i = 0; i < parsedTokens.length; i++) {
                try {
                    const tokenAddress = parsedTokens[i];
                    const provider: JSONRpcProvider = Web3API.provider;

                    const contract: IOP_20Contract = getContract<IOP_20Contract>(tokenAddress, OP_20_ABI, provider);
                    const contractInfo: ContractInformation | undefined = await Web3API.queryContractInformation(
                        tokenAddress
                    );

                    const balance = await contract.balanceOf(currentAccount.address);
                    if (!('error' in balance)) {
                        tokenBalances.push({
                            address: tokenAddress,
                            name: contractInfo?.name || '',
                            amount: BigInt(balance.decoded[0].toString()),
                            divisibility: contractInfo?.decimals || 8,
                            symbol: contractInfo?.symbol,
                            logo: contractInfo?.logo
                        });
                    }
                } catch (e) {
                    console.log(`Error processing token at index ${i}:`, e);
                    parsedTokens.splice(i, 1);
                    localStorage.setItem('tokensImported_' + getChain, JSON.stringify(parsedTokens));
                    i--;
                }
            }
            setTokens(tokenBalances);
            setTotal(1);
        } catch (e) {
            console.log(e);
            tools.toastError((e as Error).message);
        } finally {
            tools.showLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [pagination, currentAccount.address]);

    if (total === -1) {
        return (
            <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
                <LoadingOutlined />
            </Column>
        );
    }

    // if (total === 0) {
    //   return (
    //     <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
    //       {data}
    //     </Column>
    //   );
    // }
    const $footerBaseStyle = {
        display: 'block',
        minHeight: 20,
        paddingBottom: 10,
        fontSize: 12,
        cursor: 'pointer'
    } as CSSProperties;
    const $opnet = {
        display: 'block',
        minHeight: 100
    } as CSSProperties;
    const $btnStyle = {
        width: '33%',
        fontSize: '10px'
    } as CSSProperties;
    const $style = Object.assign({}, $footerBaseStyle);
    const $style2 = Object.assign({}, $opnet);
    return (
        <div>
            <Row justifyBetween mt="lg">
                <>
                    <Button
                        text="SWAP"
                        preset="primary"
                        icon="swap"
                        onClick={(e) => {
                            navigate('Swap', {});
                        }}
                        full
                    />
                </>
            </Row>
            <br />
            <BaseView style={$style2}>
                {total === 0 ? (
                    <>Empty</>
                ) : (
                    <>
                        {tokens.map((data, index) => {
                            return (
                                <div key={index}>
                                    <OpNetBalanceCard
                                        key={index}
                                        tokenBalance={data}
                                        onClick={() => {
                                            navigate('OpNetTokenScreen', {
                                                address: data.address
                                            });
                                        }}
                                    />
                                    <br />
                                </div>
                            );
                        })}
                    </>
                )}
            </BaseView>
            <BaseView style={$style}>
                <Row>
                    <Button
                        style={$btnStyle}
                        text="Import Tokens"
                        preset="fontsmall"
                        onClick={() => setImportTokenBool(true)}></Button>

                    <Button
                        style={$btnStyle}
                        text="Refresh List"
                        preset="fontsmall"
                        onClick={() => fetchData()}></Button>
                    <Button
                        style={$btnStyle}
                        text="Deploy"
                        preset="fontsmall"
                        onClick={() => navigate('DeployContract', {})}></Button>
                </Row>
            </BaseView>
            {importTokenBool && (
                <AddOpNetToken
                    setImportTokenBool={setImportTokenBool}
                    fetchData={fetchData}
                    onClose={() => {
                        setImportTokenBool(false);
                    }}
                />
            )}
        </div>
    );
}
import pandas as pd
import numpy as np
import sys
import json
from sklearn.model_selection import GridSearchCV, KFold, train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from xgboost import XGBRegressor

import warnings
warnings.filterwarnings('ignore')

def group_process(group):
    group['TTM_r'] = group['TTM'] / group['TTM'].shift(1) - 1
    group['PE_r'] = group['PE'] / group['PE'].shift(1) - 1
    group['PB_r'] = group['PB'] / group['PB'].shift(1) - 1
    group['PCF_r'] = group['PCF'] / group['PCF'].shift(1) - 1
    group['baiduindex_r'] = group['baiduindex'] / group['baiduindex'].shift(1) - 1
    group['weibo_cnsenti_r'] = group['weibo_cnsenti'] / group['weibo_cnsenti'].shift(1) - 1
    group['weibo_dictionary_r'] = group['weibo_dictionary'] / group['weibo_dictionary'].shift(1) - 1
    group['marketGDP_r'] = group['marketGDP'] / group['marketGDP'].shift(1) - 1
    group['marketpopulation_r'] = group['marketpopulation'] / group['marketpopulation'].shift(1) - 1
    group['marketaslary_r'] = group['marketaslary'] / group['marketaslary'].shift(1) - 1
    
    return group

class Model_demo:
    def __init__(self):
        self.model1_dict = {}
        # 从标准输入读取数据
        try:
            raw_data = sys.stdin.read()
            self.data_json = json.loads(raw_data)
        except Exception as e:
            print(f"错误: 无法从标准输入读取数据: {e}", file=sys.stderr)
            self.data_json = []

    def get_data_model1(self) -> pd.DataFrame:        
        try:
            # 使用从stdin读取的数据
            if not self.data_json:
                print("错误: 未获取到股票数据", file=sys.stderr)
                return pd.DataFrame()
                
            data = pd.json_normalize(self.data_json)
            
            data = data[['stockid', 'date', 'TTM', 'PE', 'PB', 'PCF', 'baiduindex', 'weibo_cnsenti', 'weibo_dictionary', 'marketGDP', 'marketpopulation', 'marketaslary']]
            data_grouped = data.groupby('stockid')
            final_data = pd.DataFrame()
            for syb, group in data_grouped:
                group = group_process(group)
                final_data = pd.concat([final_data, group])
            # 先不dropna， train里需要取label，取完drop

            return final_data
        except Exception as e:
            print(f"错误: 处理model1数据时出错: {e}", file=sys.stderr)
            return pd.DataFrame()

    def model1_train(self):
        model_name = range(4)
        labels = ['TTM', 'PE', 'PB', 'PCF']
        model_dict = {}
        data = self.get_data_model1()

        data_grouped = data.groupby('stockid')
        for i in model_name:
            data = pd.DataFrame()
            for syb, group in data_grouped:
                label = labels[i]
                group['y'] = group[label].shift(-1)
                group = group.dropna()
                data = pd.concat([data, group])
            x_train = data.drop(['stockid', 'date', 'y'], axis=1)
            y_train = data['y']
            # 可行性已经做了验证，部署中不用验证集对模型进行评估，我们只得到模型，预测，结果写进数据库

            rf = RandomForestRegressor(random_state=42)

            # 数据集太少，不适合做交叉验证
            rf.fit(x_train, y_train)

            print(rf.score(x_train, y_train)) # r2_score

            best_model = rf

            model_dict[i] = best_model
            self.model1_dict = model_dict

    def get_data_model2(self):
        try:
            # 使用从stdin读取的数据
            if not self.data_json:
                print("错误: 未获取到股票数据", file=sys.stderr)
                return pd.DataFrame()
                
            data = pd.json_normalize(self.data_json)

            def cal_dcf(row):
                dcf_value = sum((row['cash_flow_perhold_processed'] * ((1 + row['smooth_asset_growth']) / (1 + row['rfr'] * 4)) ** i) for i in range(0, 20))
                return dcf_value
            data['dcf'] = data.apply(cal_dcf, axis=1)

            # model_1
            features = ['stockid', 'date', 'TTM', 'PE', 'PB', 'PCF', 'baiduindex', 'weibo_cnsenti', 'weibo_dictionary', 'marketGDP', 'marketpopulation', 'marketaslary', \
                        'total_asset', 'quarterly_asset_growth', 'cash_flow_perhold_processed', 'rfr', 'smooth_asset_growth', 'close_price', 'dcf']
            data_temp = data[features]
            data_temp_grouped = data_temp.groupby('stockid')
            final_data_temp = pd.DataFrame()
            for syb, group in data_temp_grouped:
                group = group_process(group)
                group['label'] = group['close_price'].shift(-1)
                final_data_temp = pd.concat([final_data_temp, group])

            final_data_train = final_data_temp.drop(['stockid', 'date', 'total_asset', 'quarterly_asset_growth', 'cash_flow_perhold_processed', \
                                                'rfr', 'smooth_asset_growth', 'close_price', 'dcf', 'label'], axis=1)

            result_data = final_data_temp
            for i, model in self.model1_dict.items():
                result_data[f'y{i}'] = model.predict(final_data_train)

            return result_data
        except Exception as e:
            print(f"错误: 处理model2数据时出错: {e}", file=sys.stderr)
            return pd.DataFrame()

    def modelxgboost(self, data: pd.DataFrame):

        data = data.dropna()
        x_train = data.drop(['stockid', 'date', 'label'], axis=1)
        y_train = data['label']

        model = XGBRegressor(
            n_estimators=1000,
            learning_rate=0.08,
            subsample=0.75,
            colsample_bytree=1, 
            max_depth=7,
            gamma=0)

        model.fit(x_train, y_train)
        print(model.score(x_train, y_train))

        return model
    
    def cal_final_data(self, data: pd.DataFrame, model):
        grouped = data.groupby('stockid')
        latest = pd.DataFrame()
        for syb, group in grouped:
            latest = pd.concat([latest, group[-1:]])
        data = latest.copy()
        data['label'] = 0
        data = data[data['stockid'] != 9961] # 9961数据不全 
        data_X = data.drop(['stockid', 'date', 'label'], axis=1)
        data['label'] = model.predict(data_X)

        result = data[['stockid', 'date', 'label']]

        return result
    
    def run(self):
        data_model1 = self.get_data_model1()
        if data_model1.empty:
            print("错误: 未能获取有效的model1数据")
            return []
            
        self.model1_train()
        data_model2 = self.get_data_model2()
        if data_model2.empty:
            print("错误: 未能获取有效的model2数据")
            return []
            
        final_model = self.modelxgboost(data_model2)
        final_data = self.cal_final_data(data_model2, final_model)
        
        # 获取data_model2中的预测值y0-y3
        y_predictions = data_model2[['stockid', 'date', 'y0', 'y1', 'y2', 'y3']]

        # 构造结果字典，包含两个独立的数据部分
        result = {
            "final_predictions": final_data.to_dict(orient='records'),
            "factor_predictions": y_predictions.to_dict(orient='records')
        }

        # 返回可JSON序列化的结果 
        return result


if __name__ == '__main__':
    try:
        mmm = Model_demo()
        final_data = mmm.run()
        # 输出JSON格式结果，供Node.js解析
        print(json.dumps(final_data))
    except Exception as e:
        print(f"执行模型时出错: {e}", file=sys.stderr)
        sys.exit(1)
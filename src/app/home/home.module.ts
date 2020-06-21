import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {HomeRoutingModule} from './home-routing.module';

import {HomeComponent} from './home.component';
import {SharedModule} from '../shared/shared.module';
import {HttpClientModule} from '@angular/common/http';

import {MatButtonModule} from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';


@NgModule({
    declarations: [HomeComponent],
    imports: [CommonModule, SharedModule, HomeRoutingModule, HttpClientModule,
        MatButtonModule, MatInputModule, MatProgressSpinnerModule, BrowserAnimationsModule]
})
export class HomeModule {
}

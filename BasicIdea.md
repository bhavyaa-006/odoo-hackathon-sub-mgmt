Basic Idea


Needs- 
3 different interaction pages 
  1  - Admin interface 
    - Control over the whole system at once 
  2  - Staff interface
    - Control of day-to-day work with limited access
  3  -Customer interface
    - Can only see their own invoices and subscriptions
##Only admin can add new staff members


##NEW PRODUCT LAUNCH
whenever the company launches any new product it mentions the 
 -name -price -tyoe -notes -offers variants of companies -offers daily/weekly/monthly/yearly billing cycles , the minimum qty to buy/avail and the dates it is available.

2 kinds of plans 
 -1 infinite : billed based on the user subscriptions daily/weekly/monthly etc but can only be paused or canceled manually if not they keep deducting monthly
 -2 fixed time a Customer can buy the product for a specific date range and then pay based on ease for example buying a subscription for 6 months and it ends on 6th month so no more money cut after end of the subscription


##quote into a subscription

There should be default quote templates for large scale customers to save manual typing and addition but these should be valid only for a set number of days.


each subscription should have a serial number , customer , plan , start and ending date , payment terms , product , qty , unit price  , taxes and amount.

this process should be seen by all 3 as 

draft-quote-confirmed-active-closed

(with different lingo for the consumer only)

##billing

on billing day if there are lots and lots of subscriptions to be billed at once , the bill should be created from the subscription data with - customer details,product details , product lines , taxes and totals already filled in.

all the taxes have to be calculated automatically from the rules set by the admin
the team should just confirm , cancel , send or print the auto generated invoices

these should also be seen in all three as 

drafted - confirmed/canceled - paid

no one should be billed twice or skipped 

##discounts


no one from staff can create or share discounts only the admin can create discount rules , can be a fixed amt or a percentage of total , only in the case of some minimum purchase or qty ,start & end dates and should also be able to limit how many times a discount can be used

discount  can be applied to a specific product or the whole subscription once applied it must be shown in the next invoice automatically

##incoming money

all the income records must be present to the admins and to the staff ( but staff can only see the details for the customers assigned to them) the staff of finance team can see all the finances 

these records must contain - method of payment , amount of payment , date of payment , a note with the payment ( all in form of an invoice)

team should be able to charge consumers with overdue so outstanding payments can be closed before loss of revenue 

##Finance LEADER

He should have an interface to see all the active subscriptions,total revenue ( monthly / quarterly / semi yearly / yearly) ,payments and overdue invoices if any present 

there needs to be filters and a summary list type of view 

this page should be responsive even with 10000s of subscription data
